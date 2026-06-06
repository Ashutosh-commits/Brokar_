import { X } from "lucide-react";
import { Button } from "./ui/button";

interface Props { onClose: () => void; }

export function PrivacyPolicyModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Privacy Policy</h2>
            <p className="text-sm text-muted-foreground">Last updated: April 2025</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-5 text-sm leading-relaxed">
          <section>
            <h3 className="font-semibold text-base mb-1">1. Information We Collect</h3>
            <p className="text-muted-foreground">
              BROkar collects information you provide when you register — such as your name, email address, and optional phone number and city. We also collect usage data including which properties you view, save, or compare, as well as chat interactions with our AI assistant.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">2. How We Use Your Information</h3>
            <p className="text-muted-foreground">
              We use your data to: provide and personalise the BROkar service; save your favourite properties and preferences across sessions; send optional email notifications and newsletters (only if you opt in); improve our AI price prediction models; and maintain account security.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">3. Data Storage and Security</h3>
            <p className="text-muted-foreground">
              Your data is stored in a secured PostgreSQL database hosted in India. Passwords are hashed using bcrypt and never stored in plain text. Authentication uses short-lived JWT access tokens (15 minutes) and rotating refresh tokens (7 days). We use HTTPS for all data in transit.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">4. Cookies and Local Storage</h3>
            <p className="text-muted-foreground">
              BROkar uses browser localStorage to persist your login session and preferences. We do not use third-party tracking cookies or advertising cookies.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">5. Data Sharing</h3>
            <p className="text-muted-foreground">
              We do not sell your personal data. We may share anonymised, aggregated data (e.g. property popularity trends) publicly. If you use Google or Microsoft sign-in, those providers' privacy policies also apply.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">6. Your Rights</h3>
            <p className="text-muted-foreground">
              You may access, update, or delete your account at any time from your Profile → Settings page. Deleting your account permanently removes all your data from our servers. You may also unsubscribe from marketing emails by toggling notifications in your settings.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">7. AI and Chat Data</h3>
            <p className="text-muted-foreground">
              Conversations with the BROkar AI assistant are stored to provide context within your session. They are used only to improve response quality and are not shared with third parties. You can request deletion of your chat history by deleting your account.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-1">8. Contact</h3>
            <p className="text-muted-foreground">
              For privacy-related questions or requests, contact us at <span className="text-red-600">privacy@brokar.in</span>. We aim to respond within 5 business days.
            </p>
          </section>
        </div>

        <div className="p-4 border-t">
          <Button onClick={onClose} className="w-full bg-red-600 hover:bg-red-700">Close</Button>
        </div>
      </div>
    </div>
  );
}
