import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Separator } from "./ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Property } from ".././types/property";
import { formatCurrency } from ".././utils/priceCalculator";
import { User, UserSettings, updateProfile, fetchUserSettings, saveUserSettings, changePassword, deleteAccount, logout } from "./../lib/auth";
import { getViewedPropertiesCount, getActiveInquiries, getViewedProperties } from "./../lib/activityTracking";
import { toast } from "sonner";
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Heart,
  Home,
  TrendingUp,
  Bed,
  Bath,
  Maximize,
  LogOut,
  Camera,
  Pencil,
  Check,
  X,
  Loader2,
  Bell,
  Shield,
  Trash2,
  KeyRound,
} from "lucide-react";
import { PrivacyPolicyModal } from "./PrivacyPolicyModal";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ProfileViewProps {
  user: User;
  savedProperties: Property[];
  onRemoveFavorite: (propertyId: string) => void;
  onLogout: () => void;
  onUserUpdate: (user: User) => void;
  allProperties?: Property[];
  onNavigateToProperty?: (propertyId: string) => void;
}

// ─── Inline editable field ────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  icon: Icon,
  onSave,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  onSave: (val: string) => Promise<void>;
  type?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      setDraft(value);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => { setDraft(value); setEditing(false); };

  return (
    <div className="flex items-center gap-3 py-1">
      <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-8 text-sm"
              placeholder={placeholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              disabled={saving}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 rounded-md bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={handleCancel}
              className="p-1.5 rounded-md bg-red-100 text-red-700 hover:bg-red-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <p className="text-sm truncate">
              {value || (
                <span className="text-muted-foreground italic text-xs">
                  Not set — click pencil to add
                </span>
              )}
            </p>
            <button
              onClick={() => setEditing(true)}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-foreground transition-opacity"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Avatar seeds ─────────────────────────────────────────────────────────────

const AVATAR_SEEDS = [
  "Aanchal", "Riya", "Priya", "Aryan", "Rohan", "Vikram",
  "Sneha", "Kiran", "Amit", "Pooja", "Rahul", "Neha",
];

// ─── User icon (SVG, avoids lucide naming conflict) ───────────────────────────

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

// ─── Provider badge label ─────────────────────────────────────────────────────

function providerLabel(provider?: string) {
  if (provider === "google")    return "Google Account";
  if (provider === "microsoft") return "Microsoft Account";
  return "Verified Member";
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProfileView({
  user,
  savedProperties,
  onRemoveFavorite,
  onLogout,
  onUserUpdate,
  allProperties,
  onNavigateToProperty,
}: ProfileViewProps) {
  const [currentUser, setCurrentUser] = useState<User>(user);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"" | "saved" | "error">("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings state
  const [settings, setSettings] = useState<UserSettings>({ emailNotifications: true, priceAlerts: true, weeklyDigest: false, newsletterOptIn: false });
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Change password modal
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

  // Delete account modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Privacy policy modal
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Activity stats
  const [viewedPropertiesCount, setViewedPropertiesCount] = useState(0);
  const [activeInquiriesCount, setActiveInquiriesCount] = useState(0);
  const [activeActivity, setActiveActivity] = useState<null | 'saved' | 'viewed' | 'inquiries'>(null);

  // Load settings on mount
  useEffect(() => {
    fetchUserSettings()
      .then((s) => { setSettings(s); setSettingsLoading(false); })
      .catch(() => setSettingsLoading(false));
  }, []);

  // Load and update activity stats on mount and when savedProperties changes
  useEffect(() => {
    setViewedPropertiesCount(getViewedPropertiesCount());
    setActiveInquiriesCount(getActiveInquiries().length);
  }, [savedProperties]);

  const viewedList = getViewedProperties();
  const inquiries = getActiveInquiries();

  const findProperty = (id: string) => {
    return (allProperties || []).find((p) => p.id === id) || savedProperties.find((p) => p.id === id) || null;
  };

  const handleSettingToggle = async (key: keyof UserSettings) => {
    const previous = settings;
    const newVal = !previous[key];
    const optimistic = { ...previous, [key]: newVal };
    setSettings(optimistic);

    try {
      const updated = await saveUserSettings({ [key]: newVal });
      setSettings(updated);
      toast.success("Settings updated");
    } catch (error: any) {
      setSettings(previous);
      toast.error(error?.message || "Unable to save settings");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (newPw.length < 8) { setPwError("New password must be at least 8 characters"); return; }
    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
    setPwLoading(true);
    try {
      await changePassword(currentPw, newPw);
      setPwSuccess(true);
      setTimeout(() => { setShowChangePw(false); setPwSuccess(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }, 2000);
    } catch (e: any) {
      setPwError(e.message || "Failed to change password");
    } finally {
      setPwLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await deleteAccount();
      onLogout();
    } catch (e: any) {
      alert(e.message || "Failed to delete account");
      setDeleteLoading(false);
    }
  };

  const initials = currentUser.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleFieldSave = async (field: keyof User, value: string) => {
    try {
      const updated = await updateProfile({ [field]: value });
      setCurrentUser(updated);
      onUserUpdate(updated);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(""), 2000);
      throw new Error("Save failed");
    }
  };

  const handleAvatarSelect = async (seed: string) => {
    setAvatarSaving(true);
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
    const updated = await updateProfile({ avatar: avatarUrl });
    setCurrentUser(updated);
    onUserUpdate(updated);
    setShowAvatarPicker(false);
    setAvatarSaving(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { alert("Image must be smaller than 5MB"); return; }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      setAvatarSaving(true);
      const updated = await updateProfile({ avatar: dataUrl });
      setCurrentUser(updated);
      onUserUpdate(updated);
      setShowAvatarPicker(false);
      setAvatarSaving(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Profile</h1>
          <p className="text-muted-foreground text-sm">
            Manage your account and preferences
          </p>
        </div>
        {saveStatus === "saved" && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <Check className="w-4 h-4" /> Changes saved
          </span>
        )}
        {saveStatus === "error" && (
          <span className="text-sm text-red-600">Failed to save — please try again</span>
        )}
      </div>

      <Tabs defaultValue="profile">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="favorites">
            Saved ({savedProperties.length})
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ── Profile tab ───────────────────────────── */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Avatar Card */}
            <Card className="md:col-span-1">
              <CardHeader className="text-center pb-2">
                <div className="relative w-24 h-24 mx-auto mb-3">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                    <AvatarFallback className="text-xl">{initials}</AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center hover:bg-red-700 shadow-md transition-colors"
                    title="Change photo"
                  >
                    {avatarSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Avatar picker */}
                {showAvatarPicker && (
                  <div className="border rounded-xl p-4 bg-card shadow-lg mt-2 text-left space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Choose an avatar
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {AVATAR_SEEDS.map((seed) => (
                        <button
                          key={seed}
                          onClick={() => handleAvatarSelect(seed)}
                          className="w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-red-500 transition-colors"
                          title={seed}
                        >
                          <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                            alt={seed}
                            className="w-full h-full"
                          />
                        </button>
                      ))}
                    </div>
                    <Separator />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Or upload your own
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera className="w-3 h-3 mr-1" />
                        Upload photo (max 5MB)
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-xs"
                      onClick={() => setShowAvatarPicker(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                <CardTitle className="text-lg">{currentUser.name}</CardTitle>
                <CardDescription className="text-xs">{currentUser.email}</CardDescription>
                <Badge className="w-fit mx-auto mt-1">
                  {providerLabel(currentUser.provider)}
                </Badge>
              </CardHeader>
              <CardContent className="pt-2">
                <Button
                  className="w-full mt-2"
                  variant="destructive"
                  onClick={onLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </CardContent>
            </Card>

            {/* Contact details */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Customize your profile details. Click the pencil icon to edit each field.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <EditableField
                  label="Full Name"
                  value={currentUser.name}
                  icon={UserIcon}
                  onSave={(v) => handleFieldSave("name", v)}
                  placeholder="Your full name"
                />
                <Separator />
                <EditableField
                  label="Email Address"
                  value={currentUser.email}
                  icon={Mail}
                  type="email"
                  onSave={(v) => handleFieldSave("email", v)}
                  placeholder="you@example.com"
                />
                <Separator />
                <EditableField
                  label="Phone Number"
                  value={currentUser.phone || ""}
                  icon={Phone}
                  type="tel"
                  onSave={(v) => handleFieldSave("phone", v)}
                  placeholder="+91 98765 43210"
                />
                <Separator />
                <EditableField
                  label="City"
                  value={currentUser.city || ""}
                  icon={MapPin}
                  onSave={(v) => handleFieldSave("city", v)}
                  placeholder="Mumbai, Delhi, Bangalore…"
                />
                <Separator />
                <div className="flex items-center gap-3 py-1">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">
                      Member Since
                    </p>
                    <p className="text-sm">{currentUser.joinDate}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Activity Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <button onClick={() => setActiveActivity(activeActivity === 'saved' ? null : 'saved')} className="flex items-center gap-3 p-4 border rounded-lg text-left hover:bg-accent">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Heart className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{savedProperties.length}</p>
                      <p className="text-sm text-muted-foreground">Saved Properties</p>
                    </div>
                  </button>
                  <button onClick={() => setActiveActivity(activeActivity === 'viewed' ? null : 'viewed')} className="flex items-center gap-3 p-4 border rounded-lg text-left hover:bg-accent">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Home className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{viewedPropertiesCount}</p>
                      <p className="text-sm text-muted-foreground">Viewed Properties</p>
                    </div>
                  </button>
                  <button onClick={() => setActiveActivity(activeActivity === 'inquiries' ? null : 'inquiries')} className="flex items-center gap-3 p-4 border rounded-lg text-left hover:bg-accent">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-semibold">{activeInquiriesCount}</p>
                      <p className="text-sm text-muted-foreground">Active Inquiries</p>
                    </div>
                  </button>
                </div>
              </CardContent>

              {/* Activity details panel */}
              {activeActivity && (
                <div className="p-4 border-t">
                  <h4 className="text-sm font-medium mb-3">
                    {activeActivity === 'saved' ? 'Saved Properties' : activeActivity === 'viewed' ? 'Recently Viewed' : 'Active Inquiries'}
                  </h4>
                  <div className="space-y-2">
                    {activeActivity === 'saved' && savedProperties.length === 0 && (
                      <p className="text-sm text-muted-foreground">No saved properties</p>
                    )}

                    {activeActivity === 'saved' && savedProperties.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { if (onNavigateToProperty) onNavigateToProperty(p.id); }}
                        className="w-full text-left p-2 rounded hover:bg-muted flex items-center justify-between"
                      >
                        <span className="truncate">{p.title}</span>
                        <span className="text-xs text-muted-foreground">{p.location}</span>
                      </button>
                    ))}

                    {activeActivity === 'viewed' && viewedList.length === 0 && (
                      <p className="text-sm text-muted-foreground">No viewed properties yet</p>
                    )}

                    {activeActivity === 'viewed' && viewedList.map((v) => {
                      const p = findProperty(v.propertyId);
                      return (
                        <button
                          key={v.propertyId}
                          onClick={() => { if (onNavigateToProperty) onNavigateToProperty(v.propertyId); }}
                          className="w-full text-left p-2 rounded hover:bg-muted flex items-center justify-between"
                        >
                          <span className="truncate">{p ? p.title : v.propertyId}</span>
                          <span className="text-xs text-muted-foreground">{new Date(v.viewedAt).toLocaleString()}</span>
                        </button>
                      );
                    })}

                    {activeActivity === 'inquiries' && inquiries.length === 0 && (
                      <p className="text-sm text-muted-foreground">No active inquiries</p>
                    )}

                    {activeActivity === 'inquiries' && inquiries.map((inq) => {
                      const p = findProperty(inq.propertyId);
                      return (
                        <button
                          key={inq.id}
                          onClick={() => { if (onNavigateToProperty) onNavigateToProperty(inq.propertyId); }}
                          className="w-full text-left p-2 rounded hover:bg-muted flex items-center justify-between"
                        >
                          <span className="truncate">{p ? p.title : inq.propertyId}</span>
                          <span className="text-xs text-muted-foreground">{inq.status}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ── Favorites tab ─────────────────────────── */}
        <TabsContent value="favorites">
          <Card>
            <CardHeader>
              <CardTitle>Saved Properties ({savedProperties.length})</CardTitle>
              <CardDescription>Your favorited properties</CardDescription>
            </CardHeader>
            <CardContent>
              {savedProperties.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No saved properties yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Click the heart icon on any property to save it here
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {savedProperties.map((property) => (
                    <div key={property.id} className="border rounded-lg overflow-hidden">
                      <div className="relative h-40">
                        <ImageWithFallback
                          src={property.imageUrl}
                          alt={property.title}
                          className="w-full h-full object-cover"
                        />
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8 bg-white/90 hover:bg-white"
                          onClick={() => onRemoveFavorite(property.id)}
                          title="Remove from saved"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="p-3 space-y-1.5">
                        <p className="font-medium text-sm leading-tight">{property.title}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {property.location}
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Bed className="w-3 h-3" />{property.bedrooms}
                          </span>
                          <span className="flex items-center gap-1">
                            <Bath className="w-3 h-3" />{property.bathrooms}
                          </span>
                          <span className="flex items-center gap-1">
                            <Maximize className="w-3 h-3" />{property.sqft} sqft
                          </span>
                        </div>
                        <p className="text-sm font-medium text-green-600">
                          {formatCurrency(property.currentPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settings tab ──────────────────────────── */}
        <TabsContent value="settings" className="space-y-4">
          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" /> Notifications & Newsletter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settingsLoading ? (
                <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <>
                  {([
                    { key: "emailNotifications" as const, label: "Email Notifications", desc: "Receive updates about new properties" },
                    { key: "priceAlerts" as const, label: "Price Alerts", desc: "Get notified when prices drop in saved areas" },
                    { key: "weeklyDigest" as const, label: "Weekly Digest", desc: "Summary of market trends every Monday" },
                    { key: "newsletterOptIn" as const, label: "Email Newsletter", desc: "Property market news and investment tips" },
                  ]).map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <label htmlFor={`setting-${item.key}`} className="relative inline-flex items-center cursor-pointer">
                        <input
                          id={`setting-${item.key}`}
                          type="checkbox"
                          className="sr-only"
                          checked={settings[item.key]}
                          onChange={() => handleSettingToggle(item.key)}
                          aria-label={item.label}
                        />
                        <div className={`w-9 h-5 rounded-full transition-colors ${settings[item.key] ? "bg-red-600" : "bg-gray-200"} relative`}>
                          <div className={`absolute top-[2px] left-[2px] bg-white rounded-full h-4 w-4 transition-transform ${settings[item.key] ? "translate-x-4" : ""}`} />
                        </div>
                      </label>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" /> Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Change Password</p>
                  <p className="text-xs text-muted-foreground">Update your account password</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setShowChangePw(true); setPwError(""); setPwSuccess(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}>
                  <KeyRound className="w-4 h-4 mr-1" /> Change
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Privacy Policy</p>
                  <p className="text-xs text-muted-foreground">How we handle your data</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowPrivacy(true)}>View</Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Active Sessions</p>
                  <p className="text-xs text-muted-foreground">Signed in via {currentUser.provider || "email"}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await logout();
                      toast.success("Signed out of all sessions");
                    } catch (error: any) {
                      toast.error(error?.message || "Failed to sign out all sessions");
                    } finally {
                      onLogout();
                    }
                  }}
                >
                  Sign Out All
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 border border-red-200 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Delete Account</p>
                  <p className="text-xs text-muted-foreground">Permanently remove your account and all data</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="w-4 h-4 mr-1" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Change Password Modal ─────────────────────── */}
      {showChangePw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-red-100 dark:bg-red-900/30 p-2.5 rounded-xl">
                <KeyRound className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Change Password</h2>
                <p className="text-sm text-muted-foreground">Enter your current and new password</p>
              </div>
            </div>
            {pwSuccess ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="text-4xl">✅</div>
                <p className="font-semibold text-green-600">Password changed successfully!</p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label>Current Password</Label>
                  <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Your current password" required />
                </div>
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 8 characters" required />
                </div>
                <div className="space-y-2">
                  <Label>Confirm New Password</Label>
                  <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Repeat new password" required />
                  {confirmPw && newPw && (
                    <p className={`text-xs ${confirmPw === newPw ? "text-green-600" : "text-red-600"}`}>
                      {confirmPw === newPw ? "Passwords match ✓" : "Passwords do not match"}
                    </p>
                  )}
                </div>
                {pwError && (
                  <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{pwError}</div>
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setShowChangePw(false)} disabled={pwLoading}>Cancel</Button>
                  <Button type="submit" className="flex-1 bg-red-600 hover:bg-red-700" disabled={pwLoading}>
                    {pwLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Update Password"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Account Confirmation ───────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-100 dark:bg-red-900/30 p-2.5 rounded-xl">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-600">Delete Account</h2>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Deleting your account will permanently remove all your data, saved properties, and settings. You will be logged out immediately.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={handleDeleteAccount} disabled={deleteLoading}>
                {deleteLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : "Yes, Delete Account"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Privacy Policy Modal ──────────────────────── */}
      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
