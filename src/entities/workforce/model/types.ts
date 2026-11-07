import type { CrewColor } from '@/shared/types';

export interface TeamJobAssignment {
  id: string;
  resourceType: 'member' | 'crew';
  resourceId: string;
  label: string;
  color?: CrewColor;
  members: { id: string; name: string }[];
  assignedAt: string;
}

export interface TeamJobDraft {
  title: string;
  description: string;
  date: string;
  assignments: TeamJobAssignment[];
  projectId?: string;
  projectTitle?: string;
}

export interface TeamJob extends TeamJobDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkforceMember {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface WorkCrew {
  id: string;
  label: string;
  color: CrewColor;
  memberIds: string[];
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CrewInput {
  label: string;
  color: string;
  memberIds: string[];
}

export interface ValidatedCrewInput {
  label: string;
  color: CrewColor;
  memberIds: string[];
}
