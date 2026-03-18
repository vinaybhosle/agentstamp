export interface Stamp {
  id: string;
  wallet_address: string;
  tier: "bronze" | "silver" | "gold";
  issued_at: string;
  expires_at: string;
  certificate: string;
  signature: string;
  revoked: number;
  created_at: string;
}

export interface Agent {
  id: string;
  wallet_address: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  protocols: string[];
  endpoint_url: string;
  stamp_id: string | null;
  endorsement_count: number;
  status: string;
  registered_at: string;
  last_heartbeat: string;
  expires_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Wish {
  id: string;
  wallet_address: string;
  agent_id: string | null;
  wish_text: string;
  category: string;
  granted: number;
  granted_by: string | null;
  granted_at: string | null;
  grant_count: number;
  created_at: string;
}

export interface Endorsement {
  endorser_wallet: string;
  message: string;
  created_at: string;
}

export interface Reputation {
  score: number;
  label: "new" | "emerging" | "established" | "elite";
  breakdown: {
    tier: number;
    endorsements: number;
    uptime: number;
    age: number;
    wishes: number;
  };
  factors: {
    stamp_tier: string;
    endorsement_count: number;
    uptime_percent: number;
    days_registered: number;
    heartbeat_count: number;
    wishes_granted: number;
  };
  max_possible: {
    tier: number;
    endorsements: number;
    uptime: number;
    age: number;
    wishes: number;
  };
}

export interface StampVerification {
  success: boolean;
  stamp: Stamp | null;
  certificate: Record<string, unknown> | null;
  signature: string | null;
  public_key: string | null;
}

export interface StampStats {
  total_issued: number;
  active: number;
  by_tier: {
    bronze: number;
    silver: number;
    gold: number;
  };
  today: number;
  this_week: number;
}

export interface WellStats {
  total_wishes: number;
  total_grants: number;
  by_category: Record<string, number>;
  today: number;
  this_week: number;
}
