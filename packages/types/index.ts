// Shared type definitions used across Capstack packages and apps.

export type OnboardingStep =
  | 'COLLECT_PERSONAL_DETAILS'
  | 'LIVENESS_CHECK'
  | 'DOCUMENT_UPLOAD'
  | 'SANCTIONS_SCREEN'
  | 'BANK_STATEMENT'
  | 'INCOME_VERIFICATION'
  | 'REVIEW_AND_CONFIRM'
  | 'COMPLETE';

export interface OnboardingMessage {
  role: 'user' | 'agent';
  content: string;
  ts: string;
}

export interface OnboardingData {
  fullName: string;
  idNumber: string;
  dateOfBirth: string;
  smileJobId?: string;
  documentJobId?: string;
  sanctionsClear: boolean;
  bankStatementRef?: string;
  incomeRef?: string;
}

export interface OnboardingSession {
  sessionId: string;
  borrowerId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  history: OnboardingMessage[];
  collectedData: Partial<OnboardingData>;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingTurnInput {
  sessionId: string;
  borrowerId: string;
  userMessage: string;
  currentSession?: OnboardingSession;
}

export interface OnboardingTurnOutput {
  session: OnboardingSession;
  agentMessage: string;
  currentStep: OnboardingStep;
  isComplete: boolean;
  requiresAction?: 'UPLOAD_DOCUMENT' | 'OPEN_SMILE_SDK' | 'LINK_BANK';
}

export interface AuditEntry {
  actor: string;
  actorType: 'BORROWER' | 'STAFF' | 'SYSTEM' | 'PARTNER_API';
  action: string;
  resource: string;
  resourceId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  metadata?: Record<string, unknown>;
}

export type WorkflowStatus = 'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PENDING_DISBURSEMENT';
export type SlaStatus = 'WITHIN_SLA' | 'BREACH_SOON' | 'BREACHED';
export type AmlRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type BureauStatus = 'PULLED' | 'FAILED' | 'PENDING' | 'CONSENT_REQUIRED' | 'UNAVAILABLE';
export type ApprovalTier = 'AI_AUTO_ELIGIBLE' | 'ADVISOR_REVIEW' | 'MANAGER_SIGN_OFF';
export type ReviewPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export type ReviewEvent = {
  id?: string;
  type: string;
  actor?: string;
  createdAt: Date | string;
  payload?: unknown;
};

export type FairnessPeriod = '30d' | '90d' | '12m' | 'all';
export type ScoreBand = 'A' | 'B' | 'C' | 'D' | 'E';

export interface FairnessProvinceRow {
  province: string;
  totalApplications: number;
  approved: number;
  approvalRate: number;
  deviationFromMean: number;
}

export interface FairnessIncomeBandRow {
  band: string;
  label: string;
  totalApplications: number;
  approved: number;
  approvalRate: number;
  defaultRate: number;
}

export interface FairnessScoreBandRow {
  band: ScoreBand;
  count: number;
  approvalRate: number;
  predictedDefaultRate: number;
  actualDefaultRate: number;
}

export interface FairnessAdviserRow {
  adviserId: string;
  adviserName: string;
  totalDecisions: number;
  overrideCount: number;
  overrideRate: number;
  overrideApprovalRate: number;
  overrideDefaultRate: number;
  flagged: boolean;
}

export interface FairnessReport {
  approvalRateByProvince: FairnessProvinceRow[];
  approvalRateByIncomeBand: FairnessIncomeBandRow[];
  scoreBandDistribution: FairnessScoreBandRow[];
  overrideAnalysisByAdviser: FairnessAdviserRow[];
  dateRange: { from: string; to: string };
  generatedAt: string;
}
