import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import type { WorkCrew, WorkforceMember } from '@/entities/workforce';
import type { CrewColor } from '@/shared/types';
import { cn, generateId } from '@/shared/lib';
import { Alert, Button, Input, Modal, ModalFooter, ModalHeader } from '@/shared/ui';
import { CREW_COLORS } from '../model/crewColors';
import { teamErrorMessage } from '../model/teamErrors';

interface MemberDialogProps {
  /** Member being edited; `null` creates a new one. */
  member: WorkforceMember | null;
  onSave: (member: WorkforceMember) => Promise<unknown>;
  onClose: () => void;
}

/** Add or rename a person. Mount it only while open so its form starts fresh. */
export function MemberDialog({ member, onSave, onClose }: MemberDialogProps) {
  const [name, setName] = useState(member?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const title = member ? 'Editar persona' : 'Añadir persona';

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = new Date().toISOString();
    setSaving(true);
    setError('');
    try {
      await onSave({
        id: member?.id ?? generateId(),
        name,
        status: member?.status ?? 'active',
        createdAt: member?.createdAt ?? now,
        updatedAt: now,
      });
      onClose();
    } catch (reason) {
      setError(teamErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <ModalHeader
          title={title}
          description="Solo guardamos el nombre y si está activa en el equipo."
        />
        <Input
          autoFocus
          id="workforce-member-name"
          label="Nombre"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          autoComplete="name"
          required
        />
        {error && <Alert tone="danger">{error}</Alert>}
        <ModalFooter className="mt-0 gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar persona
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}

interface CrewDialogProps {
  crew: WorkCrew | null;
  members: WorkforceMember[];
  onSave: (crew: WorkCrew) => Promise<unknown>;
  onClose: () => void;
}

/** Create or edit a crew: label, colour and members. */
export function CrewDialog({ crew, members, onSave, onClose }: CrewDialogProps) {
  const [label, setLabel] = useState(crew?.label ?? '');
  const [color, setColor] = useState<CrewColor>(crew?.color ?? 'blue');
  const [memberIds, setMemberIds] = useState<string[]>(crew?.memberIds ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const title = crew ? 'Editar cuadrilla' : 'Crear cuadrilla';

  const toggleMember = (memberId: string) =>
    setMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = new Date().toISOString();
    setSaving(true);
    setError('');
    try {
      await onSave({
        id: crew?.id ?? generateId(),
        label,
        color,
        memberIds,
        status: crew?.status ?? 'active',
        createdAt: crew?.createdAt ?? now,
        updatedAt: now,
      });
      onClose();
    } catch (reason) {
      setError(teamErrorMessage(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <ModalHeader
          title={title}
          description="Elige un nombre, un color y las personas que la forman."
        />
        <Input
          autoFocus
          id="workforce-crew-label"
          label="Etiqueta"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={70}
          placeholder="Por ejemplo, Alba"
          required
        />
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">Color</legend>
          <div className="grid grid-cols-4 gap-2">
            {CREW_COLORS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={color === option.value}
                aria-label={`Color ${option.label}`}
                onClick={() => setColor(option.value)}
                className={cn(
                  'focus-ring flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors',
                  color === option.value
                    ? 'border-ink-strong ring-2 ring-ink-strong/15'
                    : 'border-line-strong',
                )}
                style={{ backgroundColor: option.fill, color: option.ink }}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: option.dot }} />
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink-soft">
            Personas <span className="font-normal text-ink-subtle">({memberIds.length})</span>
          </legend>
          {members.length === 0 ? (
            <p className="rounded-lg bg-canvas p-3 text-sm text-ink-subtle">
              Añade una persona antes de crear una cuadrilla.
            </p>
          ) : (
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {members.map((member) => (
                <label
                  key={member.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-canvas"
                >
                  <input
                    type="checkbox"
                    checked={memberIds.includes(member.id)}
                    onChange={() => toggleMember(member.id)}
                    className="size-4 accent-ink-strong"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{member.name}</span>
                  {member.status === 'inactive' && (
                    <span className="text-xs text-ink-subtle">Inactiva</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        {error && <Alert tone="danger">{error}</Alert>}
        <ModalFooter className="mt-0 gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            <Check size={16} aria-hidden="true" />
            Guardar cuadrilla
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
