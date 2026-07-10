export type Specialty = 'all' | 'marketer' | 'lawyer' | 'doctor' | 'manager' | 'designer' | 'hr' | 'accountant';

export interface SpecialtyInfo {
  id: Specialty;
  label: string;
  emoji: string;
  colorClass: string;
}

export const SPECIALTIES: SpecialtyInfo[] = [
  { id: 'all', label: 'Все', emoji: '🎯', colorClass: 'bg-accent/20 text-accent border-accent/30' },
  { id: 'marketer', label: 'Маркетолог', emoji: '📢', colorClass: 'bg-amber-400/15 text-amber-400 border-amber-400/30' },
  { id: 'lawyer', label: 'Юрист', emoji: '⚖️', colorClass: 'bg-blue-400/15 text-blue-400 border-blue-400/30' },
  { id: 'doctor', label: 'Врач', emoji: '🩺', colorClass: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30' },
  { id: 'manager', label: 'Руководитель', emoji: '👔', colorClass: 'bg-violet-400/15 text-violet-400 border-violet-400/30' },
  { id: 'designer', label: 'Дизайнер', emoji: '🎨', colorClass: 'bg-pink-400/15 text-pink-400 border-pink-400/30' },
  { id: 'hr', label: 'HR', emoji: '👥', colorClass: 'bg-cyan-400/15 text-cyan-400 border-cyan-400/30' },
  { id: 'accountant', label: 'Бухгалтер', emoji: '📊', colorClass: 'bg-orange-400/15 text-orange-400 border-orange-400/30' },
];

export function getSpecialtyInfo(id: Specialty): SpecialtyInfo {
  return SPECIALTIES.find(s => s.id === id) || SPECIALTIES[0];
}

export function getStoredSpecialty(): Specialty {
  if (typeof window === 'undefined') return 'all';
  return (localStorage.getItem('ai-learning-specialty') as Specialty) || 'all';
}

export function setStoredSpecialty(specialty: Specialty): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ai-learning-specialty', specialty);
  }
}

/**
 * Preprocesses markdown content to filter specialty-tagged sections.
 * 
 * Sections between <!-- SPEC:specialty_id --> and <!-- /SPEC --> are:
 * - Shown when selectedSpecialty is 'all' (markers removed)
 * - Shown when selectedSpecialty matches the section's specialty
 * - Hidden (removed) otherwise
 */
export function filterContentBySpecialty(content: string, selectedSpecialty: Specialty): string {
  const regex = /<!-- SPEC:(\w+) -->([\s\S]*?)<!-- \/SPEC -->/g;

  if (selectedSpecialty === 'all') {
    // Show everything, just remove the markers
    return content.replace(regex, '$2');
  }

  // Keep matching sections, remove non-matching
  return content.replace(regex, (_match, spec: string, innerContent: string) => {
    if (spec === selectedSpecialty || spec === 'all') {
      return innerContent;
    }
    return '';
  });
}
