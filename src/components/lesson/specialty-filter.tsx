"use client";

import { useState, useEffect } from "react";
import {
  type Specialty,
  type SpecialtyInfo,
  SPECIALTIES,
  getStoredSpecialty,
  setStoredSpecialty,
} from "@/lib/specialties";

interface SpecialtyFilterProps {
  onChange: (specialty: Specialty) => void;
  selected?: Specialty;
  className?: string;
}

/**
 * Horizontal chip selector for specialties.
 * Persists selection in localStorage.
 */
export function SpecialtyFilter({ onChange, selected, className = "" }: SpecialtyFilterProps) {
  const [activeSpecialty, setActiveSpecialty] = useState<Specialty>(selected || "all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!selected) {
      const stored = getStoredSpecialty();
      setActiveSpecialty(stored);
      onChange(stored);
    }
  }, []);

  const handleSelect = (specialty: Specialty) => {
    setActiveSpecialty(specialty);
    setStoredSpecialty(specialty);
    onChange(specialty);
  };

  if (!mounted) {
    return (
      <div className={`specialty-filter-container ${className}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            Специальность
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.map((s) => (
            <div key={s.id} className="h-8 w-20 skeleton rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`specialty-filter-container ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">
          Специальность
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {SPECIALTIES.map((s: SpecialtyInfo) => {
          const isActive = activeSpecialty === s.id;
          return (
            <button
              key={s.id}
              onClick={() => handleSelect(s.id)}
              className={`specialty-chip ${
                isActive
                  ? s.colorClass
                  : "bg-card text-muted border-border hover:border-border-hover hover:text-foreground"
              }`}
            >
              <span className="text-sm">{s.emoji}</span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
