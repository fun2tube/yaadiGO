"use client";

import { useState } from "react";
import { ChevronIcon, SparkleIcon } from "@/components/icons";
import { PACES, TRAVEL_WITH, BUDGET_BANDS, INTERESTS } from "@/lib/planner";

const POPULAR = [
  "Kashmir",
  "Ladakh",
  "Kerala",
  "Rajasthan",
  "Meghalaya",
  "Vietnam",
  "Bali",
  "Thailand",
];

const STEPS = ["Where & when", "Who & how", "What you like"];

const FIELD =
  "w-full rounded-xl border border-paper-line-strong bg-card px-4 py-3 text-[15px] text-paper-text outline-none transition-colors placeholder:text-paper-text-faint focus:border-accent focus:ring-4 focus:ring-accent/10";
const MICRO_LABEL =
  "eyebrow text-paper-text-faint";

function Chip({ active, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-all ${
        active
          ? "border-accent bg-accent text-white shadow-sm shadow-accent/30"
          : "border-paper-line-strong bg-card text-paper-text-muted hover:border-accent/50 hover:text-paper-text"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

export default function PlanForm({ initialValues, onSubmit, disabled }) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState(null);

  const set = (patch) => setValues((v) => ({ ...v, ...patch }));

  function toggleInterest(interest) {
    set({
      interests: values.interests.includes(interest)
        ? values.interests.filter((i) => i !== interest)
        : [...values.interests, interest],
    });
  }

  function next() {
    if (step === 0 && values.destination.trim().length < 2) {
      setError("Tell us where you'd like to go.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (values.destination.trim().length < 2) {
      setStep(0);
      setError("Tell us where you'd like to go.");
      return;
    }
    onSubmit(values);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-2xl border border-paper-line bg-card shadow-xl shadow-ink/5"
    >
      {/* Step rail */}
      <div className="flex border-b border-paper-line bg-paper-dim">
        {STEPS.map((title, i) => (
          <button
            key={title}
            type="button"
            onClick={() => setStep(i)}
            className={`flex flex-1 items-center justify-center gap-2 px-3 py-3.5 eyebrow transition-colors ${
              i === step
                ? "bg-card text-accent-deep"
                : "text-paper-text-faint hover:text-paper-text-muted"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                i <= step ? "bg-accent text-white" : "bg-paper-line-strong text-paper-text-faint"
              }`}
            >
              {i + 1}
            </span>
            <span className="hidden sm:inline">{title}</span>
          </button>
        ))}
      </div>

      <div className="p-6 sm:p-8">
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <div>
              <label htmlFor="destination" className={MICRO_LABEL}>
                Where do you want to go?
              </label>
              <input
                id="destination"
                className={`${FIELD} mt-2`}
                value={values.destination}
                onChange={(e) => set({ destination: e.target.value })}
                placeholder="Kashmir, Vietnam, or somewhere with mountains and no crowds"
                autoComplete="off"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {POPULAR.map((place) => (
                  <Chip
                    key={place}
                    active={values.destination === place}
                    onClick={() => set({ destination: place })}
                  >
                    {place}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="durationDays" className={MICRO_LABEL}>
                  How many days
                </label>
                <div className="mt-2 flex items-center gap-4">
                  <input
                    id="durationDays"
                    type="range"
                    min="2"
                    max="21"
                    value={values.durationDays}
                    onChange={(e) => set({ durationDays: Number(e.target.value) })}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-paper-line-strong accent-accent"
                  />
                  <span className="w-16 shrink-0 text-right font-display text-[20px] font-bold text-paper-text tabular-nums">
                    {values.durationDays}
                    <span className="ml-1 text-[13px] font-medium text-paper-text-faint">d</span>
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="month" className={MICRO_LABEL}>
                  When (roughly)
                </label>
                <input
                  id="month"
                  className={`${FIELD} mt-2`}
                  value={values.month}
                  onChange={(e) => set({ month: e.target.value })}
                  placeholder="Early December, or not decided"
                  autoComplete="off"
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="travellers" className={MICRO_LABEL}>
                  How many travellers
                </label>
                <input
                  id="travellers"
                  type="number"
                  min="1"
                  max="40"
                  className={`${FIELD} mt-2`}
                  value={values.travellers}
                  onChange={(e) => set({ travellers: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <span className={MICRO_LABEL}>Travelling as</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {TRAVEL_WITH.map((t) => (
                    <Chip
                      key={t.value}
                      active={values.travelWith === t.value}
                      onClick={() => set({ travelWith: t.value })}
                    >
                      {t.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <span className={MICRO_LABEL}>Budget per person, excluding flights</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {BUDGET_BANDS.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => set({ budget: b.value })}
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${
                      values.budget === b.value
                        ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                        : "border-paper-line-strong hover:border-accent/40"
                    }`}
                  >
                    <span className="block text-[14px] font-bold text-paper-text">{b.label}</span>
                    <span className="mt-0.5 block text-[12px] text-paper-text-faint">
                      {b.detail}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <span className={MICRO_LABEL}>Pace</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {PACES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => set({ pace: p.value })}
                    className={`rounded-xl border px-4 py-3 text-left transition-all ${
                      values.pace === p.value
                        ? "border-accent bg-accent/5 ring-2 ring-accent/20"
                        : "border-paper-line-strong hover:border-accent/40"
                    }`}
                  >
                    <span className="block text-[14px] font-bold text-paper-text">{p.label}</span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-paper-text-faint">
                      {p.detail}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className={MICRO_LABEL}>What you&apos;re into</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {INTERESTS.map((interest) => (
                  <Chip
                    key={interest}
                    active={values.interests.includes(interest)}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="notes" className={MICRO_LABEL}>
                Anything else we should plan around?
              </label>
              <textarea
                id="notes"
                rows={3}
                maxLength={600}
                className={`${FIELD} mt-2 resize-y`}
                value={values.notes}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Travelling with my parents, one of us can't do long treks, must be back by the 14th…"
              />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-[13px] font-semibold text-danger">
            {error}
          </p>
        )}

        <div className="mt-7 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(s - 1, 0))}
            disabled={step === 0}
            className="text-[13.5px] font-semibold text-paper-text-muted transition-opacity disabled:invisible"
          >
            ← Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-1.5 rounded-full bg-ink px-6 py-3 text-[14px] font-bold text-ink-text transition-transform hover:scale-[1.03]"
            >
              Continue <ChevronIcon size={15} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled}
              className="flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-[14.5px] font-bold text-white shadow-lg shadow-accent/30 transition-transform hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              <SparkleIcon size={16} />
              {disabled ? "Planning…" : "Build my itinerary"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
