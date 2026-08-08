export interface Team {
  _id: string;
  name: string;
  owner?: { _id: string; email?: string } | string;
  members?: Array<{ _id: string; email?: string; name?: string; role?: string } | string>;
}

export interface TeamInvite {
  _id: string;
  invitedEmail: string;
  status: "pending" | "accepted" | "rejected";
  team?: { _id: string; name?: string } | string;
  invitedBy?: { _id: string; email?: string; name?: string } | string;
  createdAt?: string;
}

export interface Pin {
  _id: string;
  title: string;
  url: string;
  summary?: string | null;
  tags?: string[];
  favicon?: string | null;
}

export interface BillingStateResponse {
  profile?: {
    displayName?: string;
    profileHandle?: string;
    statusMessage?: string;
    allowInvites?: boolean;
    autoRenew?: boolean;
    picture?: string;
  };
  billing?: {
    hasSubscription?: boolean;
    currentPlanId?: string;
    currentPlanName?: string;
    subscriptionStatus?: string;
    billingPeriod?: string;
    nextBillingDate?: string | null;
    canManageBilling?: boolean;
  };
}

export interface Plan {
  _id: string;
  name: string;
  monthlyPrice?: number;
  yearlyPrice?: number;
  monthlyPriceId?: string;
  yearlyPriceId?: string;
  features?: string[];
}
