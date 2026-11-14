import { describe, expect, it } from 'vitest';
import { buildProjectAssignment, findCrewAssignmentForMember } from '../src/project/assignments';

const ana = { id: 'member-ana', name: 'Ana Pérez', status: 'active' as const };
const luis = { id: 'member-luis', name: 'Luis Díaz', status: 'inactive' as const };
const crew = {
  id: 'crew-alba',
  label: 'Alba',
  color: 'green' as const,
  memberIds: [ana.id, luis.id],
  status: 'active' as const,
};

describe('project assignment snapshots', () => {
  it('snapshots a member with a deterministic assignment ID', () => {
    expect(
      buildProjectAssignment({ resourceType: 'member', resource: ana }, '2026-11-05T10:00:00.000Z'),
    ).toEqual({
      id: 'member_member-ana',
      resourceType: 'member',
      resourceId: ana.id,
      label: 'Ana Pérez',
      members: [{ id: ana.id, name: 'Ana Pérez' }],
      assignedAt: '2026-11-05T10:00:00.000Z',
    });
  });

  it('snapshots a crew label and color with active members only', () => {
    expect(
      buildProjectAssignment(
        { resourceType: 'crew', resource: crew, members: [ana, luis] },
        '2026-11-05T10:00:00.000Z',
      ),
    ).toMatchObject({
      id: 'crew_crew-alba',
      resourceType: 'crew',
      resourceId: crew.id,
      label: 'Alba',
      color: 'green',
      members: [{ id: ana.id, name: 'Ana Pérez' }],
    });
  });

  it('finds whether a project crew snapshot already includes a person', () => {
    const crewSnapshot = buildProjectAssignment(
      { resourceType: 'crew', resource: crew, members: [ana, luis] },
      '2026-11-05T10:00:00.000Z',
    );

    expect(findCrewAssignmentForMember(ana.id, [crewSnapshot])).toEqual(crewSnapshot);
    expect(findCrewAssignmentForMember(luis.id, [crewSnapshot])).toBeUndefined();
    expect(findCrewAssignmentForMember('member-other', [crewSnapshot])).toBeUndefined();
  });

  it('rejects inactive resources and crews without active members', () => {
    expect(() =>
      buildProjectAssignment(
        { resourceType: 'member', resource: { ...ana, status: 'inactive' } },
        '2026-11-05T10:00:00.000Z',
      ),
    ).toThrow(/activ/i);
    expect(() =>
      buildProjectAssignment(
        {
          resourceType: 'crew',
          resource: crew,
          members: [{ ...ana, status: 'inactive' }, luis],
        },
        '2026-11-05T10:00:00.000Z',
      ),
    ).toThrow(/activ/i);
  });

  it('rejects assignment documents at or above 900,000 UTF-8 bytes', () => {
    const members = Array.from({ length: 10_000 }, (_, index) => ({
      id: `member-${index}-${'x'.repeat(80)}`,
      name: 'A'.repeat(100),
      status: 'active' as const,
    }));
    const largeCrew = {
      id: 'crew-large',
      label: 'Obra',
      color: 'blue' as const,
      memberIds: members.map((member) => member.id),
      status: 'active' as const,
    };
    expect(() =>
      buildProjectAssignment(
        { resourceType: 'crew', resource: largeCrew, members },
        '2026-11-05T10:00:00.000Z',
      ),
    ).toThrow(/900\.000/);
  });

  it('uses stable IDs for repeated assignments of the same resource', () => {
    const first = buildProjectAssignment(
      { resourceType: 'member', resource: ana },
      '2026-11-05T10:00:00.000Z',
    );
    const retry = buildProjectAssignment(
      { resourceType: 'member', resource: ana },
      '2026-11-06T10:00:00.000Z',
    );
    expect(retry.id).toBe(first.id);
  });
});
