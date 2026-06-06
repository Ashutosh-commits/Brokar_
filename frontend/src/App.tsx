import { preloadPredictions } from './usePricePrediction';
import { useState, useRef, useEffect, useCallback } from "react";
import { PropertyCard } from "./components/PropertyCard";
import { ProfileView } from "./components/ProfileView";
import { ChatBot } from "./components/ChatBot";
import { PropertyComparison } from "./components/PropertyComparison";
import { LandingPage } from "./components/LandingPage";
import { LoginSignup } from "./components/LoginSignup";
import {
  loadUser, clearUser, isAuthenticated, User,
  fetchFavoriteIds, addFavorite, removeFavorite,
  resetPassword,
} from "./lib/auth";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { Slider } from "./components/ui/slider";
import {
  Home, User as UserIcon, MessageCircle, Search,
  SlidersHorizontal, TrendingUp, GitCompare, LogIn,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "./components/ui/popover";
import { Separator } from "./components/ui/separator";
import { ResetPasswordModal } from "./components/ResetPasswordModal";
import { api } from "./lib/api";
import { Property } from "./types/property";
import { matchesPropertyQuery, normalizeSearchText } from "./utils/propertySearch";
import { useFormattedStats } from "./hooks/usePropertyStats";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";

type View = "landing" | "dashboard" | "profile" | "login";

const ITEMS_PER_PAGE = 12;
const MAX_PRICE = 90000000;

export default function App() {
  const [currentView, setCurrentView] = useState<View>("landing");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("price-asc");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
  const [currentUser, setCurrentUser] = useState<User | null>(loadUser());
  const [properties, setProperties] = useState<Property[]>([]);
  const [isPropertiesLoading, setIsPropertiesLoading] = useState(true);

  // Reset password modal (from email link)
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState<string | null>(null);

  // Infinite scroll
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Advanced filters
  const [priceRange, setPriceRange] = useState<number[]>([0, MAX_PRICE]);
  const [bedroomFilter, setBedroomFilter] = useState<string>("all");
  const [bathroomFilter, setBathroomFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [bhkFilter, setBhkFilter] = useState<string>("all");

  // ── Detect reset token in URL on mount ───────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("reset_token");
    const email = params.get("email");
    if (token && email) {
      setResetToken(token);
      setResetEmail(email);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // ── Load favorites from API on login ─────────────────────────────────────────
  useEffect(() => {
    if (isLoggedIn) {
      fetchFavoriteIds()
        .then((ids) => setFavoriteIds(new Set(ids)))
        .catch(() => {});
    }
  }, [isLoggedIn]);

  // ── Load properties from backend API ─────────────────────────────────────────
  const cancelPropertiesFetch = useRef(false);

  const fetchProperties = useCallback(async () => {
    cancelPropertiesFetch.current = false;
    setIsPropertiesLoading(true);

    try {
      const { data } = await api.get("/properties", {
        params: { page: 1, limit: 2000, sort: "price-asc" },
      });

      if (cancelPropertiesFetch.current) return;

      const loaded = Array.isArray(data?.data) ? data.data : [];
      setProperties(loaded);

      if (loaded.length > 0) {
        preloadPredictions(loaded.slice(0, 12));
      }
    } catch (error: any) {
      if (!cancelPropertiesFetch.current) {
        console.error("Failed to load properties", error);
        setProperties([]);
      }
    } finally {
      if (!cancelPropertiesFetch.current) setIsPropertiesLoading(false);
    }
  }, []);

  useEffect(() => {
    cancelPropertiesFetch.current = false;
    fetchProperties();
    return () => {
      cancelPropertiesFetch.current = true;
    };
  }, [fetchProperties]);

  // ── Auth handlers ─────────────────────────────────────────────────────────────

  const handleLogin = (user: User) => {
    setIsLoggedIn(true);
    setCurrentUser(user);
    // Show subtle welcome toast
    toast.success(`Welcome${user.name ? ", " + user.name.split(" ")[0] : user.username ? ", " + user.username : ""}!`);
    setCurrentView("dashboard");
  };

  const handleLogout = () => {
    clearUser();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentView("landing");
    setFavoriteIds(new Set());
    setCompareIds(new Set());
  };

  const handleUserUpdate = (updated: User) => {
    setCurrentUser(updated);
  };

  // ── Navigate to dashboard if already logged in ────────────────────────────────

  const handleGetStarted = () => {
    if (isLoggedIn) setCurrentView("dashboard");
    else setCurrentView("login");
  };

  const handleLogoClick = () => {
    // Always navigate to the public landing page when the logo is clicked.
    setCurrentView("landing");
  };

  // ── Property handlers ─────────────────────────────────────────────────────────

  const toggleFavorite = useCallback(async (propertyId: string) => {
    const isFav = favoriteIds.has(propertyId);
    // Optimistic update
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(propertyId) : next.add(propertyId);
      return next;
    });
    // Sync to backend
    try {
      if (isFav) await removeFavorite(propertyId);
      else await addFavorite(propertyId);
    } catch {
      // Revert on failure
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        isFav ? next.add(propertyId) : next.delete(propertyId);
        return next;
      });
    }
  }, [favoriteIds]);

  const toggleCompare = (propertyId: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(propertyId)) { next.delete(propertyId); }
      else { if (next.size >= 4) return prev; next.add(propertyId); }
      return next;
    });
  };

  const removeFromComparison = (propertyId: string) => {
    setCompareIds((prev) => { const next = new Set(prev); next.delete(propertyId); return next; });
  };

  const clearFilters = () => {
    setSearchQuery(""); setFilterType("all"); setSortBy("price-asc");
    setPriceRange([0, MAX_PRICE]); setBedroomFilter("all");
    setBathroomFilter("all"); setCityFilter("all"); setBhkFilter("all");
    setVisibleCount(ITEMS_PER_PAGE);
  };

  useEffect(() => { setVisibleCount(ITEMS_PER_PAGE); }, [searchQuery, filterType, sortBy, priceRange, bedroomFilter, bathroomFilter, cityFilter, bhkFilter]);

  // ── Infinite scroll ───────────────────────────────────────────────────────────

  const loadMore = useCallback(() => {
    setIsLoadingMore(true);
    setTimeout(() => { setVisibleCount((prev) => prev + ITEMS_PER_PAGE); setIsLoadingMore(false); }, 300);
  }, []);

  const sentinelCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) { observerRef.current.disconnect(); observerRef.current = null; }
      if (!node) return;
      observerRef.current = new IntersectionObserver(
        (entries) => { if (entries[0].isIntersecting) loadMore(); },
        { threshold: 0, rootMargin: "300px" }
      );
      observerRef.current.observe(node);
    },
    [loadMore]
  );

  // ── Derived data ──────────────────────────────────────────────────────────────

  const filteredProperties = properties
    .filter((property) => {
      const normalizedQuery = normalizeSearchText(searchQuery);
      const matchesPrimary = matchesPropertyQuery(searchQuery, [
        property.title,
        property.location,
        property.city,
      ]);
      const matchesDescription =
        normalizedQuery.length > 0 &&
        normalizeSearchText(property.description).includes(normalizedQuery);
      const matchesSearch = matchesPrimary || matchesDescription;
      const matchesType = filterType === "all" || property.propertyType === filterType;
      const matchesPrice = property.currentPrice >= priceRange[0] && property.currentPrice <= priceRange[1];
      const matchesBedrooms = bedroomFilter === "all" || property.bedrooms >= parseInt(bedroomFilter);
      const matchesBathrooms = bathroomFilter === "all" || property.bathrooms >= parseInt(bathroomFilter);
      const matchesCity = cityFilter === "all" || property.city === cityFilter;
      const matchesBHK = bhkFilter === "all" || property.bhkType === bhkFilter;
      return matchesSearch && matchesType && matchesPrice && matchesBedrooms && matchesBathrooms && matchesCity && matchesBHK;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "price-asc": return a.currentPrice - b.currentPrice;
        case "price-desc": return b.currentPrice - a.currentPrice;
        case "appreciation": return b.appreciationRate - a.appreciationRate;
        default: return 0;
      }
    });

  const visibleProperties = filteredProperties.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProperties.length;

  const navigateToProperty = useCallback((propertyId: string) => {
    setCurrentView("dashboard");
    setTimeout(() => {
      const el = document.getElementById(`property-${propertyId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 250);
  }, []);

  // Get formatted stats that update automatically
  const stats = useFormattedStats(filteredProperties);

  const savedProperties = properties.filter((p) => favoriteIds.has(p.id));
  const compareProperties = properties.filter((p) => compareIds.has(p.id));

  const hasActiveFilters = searchQuery || filterType !== "all" || bedroomFilter !== "all" || bathroomFilter !== "all" || priceRange[0] !== 0 || priceRange[1] !== MAX_PRICE || cityFilter !== "all" || bhkFilter !== "all";

  const uniqueCities = Array.from(new Set(properties.map((p) => p.city))).sort();

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          {/* Logo */}
          <div
            className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity group"
            onClick={handleLogoClick}
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-red-800 rounded-xl blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative bg-gradient-to-br from-red-600 to-red-800 p-3 rounded-xl shadow-xl">
                <Home className="w-7 h-7 text-white" />
                <TrendingUp className="w-4 h-4 text-white absolute -bottom-1 -right-1" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="leading-none flex items-baseline">
                <span className="text-3xl font-bold text-red-600">BRO</span>
                <span className="text-3xl text-black dark:text-white">kar</span>
              </div>
              <span className="text-sm text-muted-foreground leading-none mt-1">Property Predictions</span>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <Button variant={currentView === "dashboard" ? "default" : "ghost"} onClick={() => setCurrentView("dashboard")} className="gap-2">
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>

                <Button variant={currentView === "profile" ? "default" : "ghost"} onClick={() => setCurrentView("profile")} className="gap-2 relative">
                  {currentUser?.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <UserIcon className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">{currentUser?.name?.split(" ")[0] ?? "Profile"}</span>
                  {favoriteIds.size > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">{favoriteIds.size}</Badge>
                  )}
                </Button>

                {compareIds.size > 0 && (
                  <Button variant="outline" onClick={() => setIsComparisonOpen(true)} className="gap-2 relative">
                    <GitCompare className="w-4 h-4" />
                    <span className="hidden sm:inline">Compare</span>
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">{compareIds.size}</Badge>
                  </Button>
                )}

                <Button variant="outline" onClick={() => setIsChatOpen(true)} className="gap-2">
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Chat</span>
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setIsChatOpen(true)} className="gap-2">
                  <MessageCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Chat</span>
                </Button>
                <Button onClick={() => setCurrentView("login")} className="gap-2">
                  <LogIn className="w-4 h-4" />
                  <span>Login / Register</span>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto p-4 md:p-6">
        {currentView === "landing" ? (
          <LandingPage
            onGetStarted={handleGetStarted}
            onLogin={() => setCurrentView("login")}
            isLoggedIn={isLoggedIn}
            properties={properties}
            isLoading={isPropertiesLoading}
            favoriteIds={favoriteIds}
            compareIds={compareIds}
            toggleFavorite={isLoggedIn ? toggleFavorite : undefined}
            toggleCompare={isLoggedIn ? toggleCompare : undefined}
          />
        ) : currentView === "dashboard" ? (
          <div className="space-y-6">
            <div>
              <h1>Property Listings</h1>
              <p className="text-muted-foreground">Explore properties with AI-powered price predictions</p>
            </div>

            {/* Search and filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by title or location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[160px]">
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Property Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="condo">Condo</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                      <SlidersHorizontal className="w-4 h-4" />
                      More Filters
                      {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-5 px-1">•</Badge>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4>Advanced Filters</h4>
                          {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-1">Clear all</Button>
                          )}
                        </div>
                        <Separator />
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm">City</label>
                        <Select value={cityFilter} onValueChange={setCityFilter}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Cities</SelectItem>
                            {uniqueCities.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm">BHK Type</label>
                        <Select value={bhkFilter} onValueChange={setBhkFilter}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="1BHK">1BHK</SelectItem>
                            <SelectItem value="2BHK">2BHK</SelectItem>
                            <SelectItem value="3BHK">3BHK</SelectItem>
                            <SelectItem value="4BHK">4BHK</SelectItem>
                            <SelectItem value="5BHK+">5BHK+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm">
                          Price Range: ₹{(priceRange[0] / 100000).toFixed(0)}L – ₹{(priceRange[1] / 100000).toFixed(0)}L
                        </label>
                        <div className="pt-2">
                          <Slider value={priceRange} onValueChange={setPriceRange} min={0} max={MAX_PRICE} step={500000} className="w-full" />
                          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                            <span>₹0</span><span>₹900L</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm">Minimum Bedrooms</label>
                        <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any</SelectItem>
                            <SelectItem value="1">1+</SelectItem>
                            <SelectItem value="2">2+</SelectItem>
                            <SelectItem value="3">3+</SelectItem>
                            <SelectItem value="4">4+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm">Minimum Bathrooms</label>
                        <Select value={bathroomFilter} onValueChange={setBathroomFilter}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any</SelectItem>
                            <SelectItem value="1">1+</SelectItem>
                            <SelectItem value="2">2+</SelectItem>
                            <SelectItem value="3">3+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[180px] sm:w-[180px] flex-1 sm:flex-none">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price-asc">Price: Low to High</SelectItem>
                    <SelectItem value="price-desc">Price: High to Low</SelectItem>
                    <SelectItem value="appreciation">Best Appreciation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 border rounded-lg bg-card">
                <p className="text-sm text-muted-foreground">Total Properties</p>
                <p className="text-2xl">{stats.totalProperties}</p>
                {hasMore && <p className="text-xs text-muted-foreground mt-1">Showing {visibleProperties.length}</p>}
              </div>
              <div className="p-4 border rounded-lg bg-card">
                <p className="text-sm text-muted-foreground">Average Price</p>
                <p className="text-2xl">{stats.averagePriceFormatted}</p>
              </div>
              <div className="p-4 border rounded-lg bg-card">
                <p className="text-sm text-muted-foreground">Avg. Appreciation</p>
                <p className="text-2xl">{stats.averageAppreciation}%</p>
              </div>
            </div>

            {/* Property grid */}
            {isPropertiesLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading properties...</p>
              </div>
            ) : filteredProperties.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No properties found matching your criteria.</p>
                {hasActiveFilters && <Button variant="outline" onClick={clearFilters} className="mt-4">Clear Filters</Button>}
              </div>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {visibleProperties.map((property) => (
                    <PropertyCard
                      key={property.id}
                      property={property}
                      isFavorite={favoriteIds.has(property.id)}
                      onToggleFavorite={isLoggedIn ? toggleFavorite : undefined}
                      isComparing={compareIds.has(property.id)}
                      onToggleCompare={isLoggedIn ? toggleCompare : undefined}
                    />
                  ))}
                </div>

                {hasMore ? (
                  <div ref={sentinelCallbackRef} className="flex flex-col items-center gap-3 py-10">
                    <div className="flex gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-bounce" />
                    </div>
                    <p className="text-sm text-muted-foreground">Loading more… ({visibleProperties.length} of {filteredProperties.length})</p>
                  </div>
                ) : (
                  <div className="text-center py-8 border-t">
                    <p className="text-sm text-muted-foreground">✓ All {filteredProperties.length} properties loaded</p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : currentView === "profile" ? (
          <ProfileView
            user={currentUser!}
            savedProperties={savedProperties}
            onRemoveFavorite={toggleFavorite}
            onLogout={handleLogout}
            onUserUpdate={handleUserUpdate}
            allProperties={properties}
            onNavigateToProperty={navigateToProperty}
          />
        ) : (
          <LoginSignup onLogin={handleLogin} onBack={() => setCurrentView(isLoggedIn ? "dashboard" : "landing")} />
        )}
      </main>

      {/* ChatBot */}
      <ChatBot open={isChatOpen} onOpenChange={setIsChatOpen} user={currentUser} />

      {/* Property Comparison */}
      <PropertyComparison properties={compareProperties} open={isComparisonOpen} onOpenChange={setIsComparisonOpen} onRemoveProperty={removeFromComparison} />

      {/* Reset Password Modal (from email link) */}
      {resetToken && resetEmail && (
        <ResetPasswordModal
          token={resetToken}
          email={resetEmail}
          onClose={() => { setResetToken(null); setResetEmail(null); }}
          onSuccess={() => { setResetToken(null); setResetEmail(null); setCurrentView("login"); }}
        />
      )}

      {/* Floating Chat Button */}
      {!isChatOpen && (
        <div className="fixed bottom-6 right-6 z-40 group">
          <div className="absolute right-16 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
            <div className="bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg whitespace-nowrap">
              Chat with <span className="font-bold text-white">BRO</span>kar!
            </div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full w-0 h-0 border-t-8 border-t-transparent border-l-8 border-l-red-600 border-b-8 border-b-transparent -mr-2" />
          </div>
          <Button
            className="h-14 w-14 rounded-full shadow-lg bg-red-600 hover:bg-red-700 relative animate-bounce"
            size="icon"
            onClick={() => setIsChatOpen(true)}
          >
            <MessageCircle className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
          </Button>
        </div>
      )}
    </div>
  );
}
