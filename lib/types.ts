export type BillingCycle = "weekly" | "monthly" | "yearly";
export type CancelDifficulty = "easy" | "medium" | "hard" | "hostile";
export type Category =
  | "streaming"
  | "music"
  | "fitness"
  | "software"
  | "ai"
  | "news"
  | "shopping"
  | "food"
  | "cloud"
  | "gaming"
  | "other";
export type SubStatus = "active" | "cancelling" | "cancelled";
export type Plan = "free" | "plus" | "share";

export type CancelStep = {
  title: string;
  body: string;
  warning?: string;
};

export type Merchant = {
  id: string;
  name: string;
  category: Category;
  aliases: string[];
  color: string;
  letter: string;
  typicalPrice: number;
  cycle: BillingCycle;
  cancelUrl: string;
  manageUrl: string;
  cancelDifficulty: CancelDifficulty;
  darkPatterns: string[];
  cancelSteps: CancelStep[];
  notice?: string;
  phone?: string;
};

export type Subscription = {
  id: string;
  merchantId: string | null;
  name: string;
  amount: number;
  cycle: BillingCycle;
  lastUsedAt: string | null;
  startedAt: string;
  nextChargeAt: string;
  status: SubStatus;
  bankDescriptor?: string;
  notes?: string;
  cancelledAt?: string;
  source?: "inbox" | "statement" | "manual";
};

export type SavingsEvent = {
  id: string;
  subscriptionId: string;
  name: string;
  monthlyAmount: number;
  cancelledAt: string;
};

export type Profile = {
  name: string;
  email: string;
};

export type InboxDiscovery = {
  merchantId: string | null;
  name: string;
  amount: number;
  cycle: BillingCycle;
  kind: "receipt" | "plan" | "account";
  free: boolean;
  estimated: boolean;
  subject: string;
  from: string;
};

export type AppState = {
  profile: Profile | null;
  plan: Plan;
  unusedDays: number;
  subscriptions: Subscription[];
  savings: SavingsEvent[];
  inboxPrompt: "pending" | "allowed" | "skipped";
  inboxScannedAt: string | null;
  inboxDiscoveries: InboxDiscovery[];
};

export type StatementMatch = {
  raw: string;
  descriptor: string;
  amount: number | null;
  date: string | null;
  merchant: Merchant | null;
  confidence: number;
};
