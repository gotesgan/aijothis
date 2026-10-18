"use client";

import { useTranslations } from "next-intl";
import { Mars, Venus, User } from "lucide-react";

import type { Gender } from "@/lib/types";

const OPTIONS = [
  { value: "female", labelKey: "genderF", Icon: Venus },
  { value: "male", labelKey: "genderM", Icon: Mars },
  { value: "other", labelKey: "genderN", Icon: User },
] as const satisfies readonly { value: Gender; labelKey: string; Icon: typeof Mars }[];

/**
 * One gender control for the whole app, shared by the birth-details form and
 * the report form so the choice can never mean two different things.
 *
 * It is a segmented choice rather than a dropdown: three short options cost
 * less as visible pills than as a select the user has to open. Built on real
 * radio inputs, so arrow keys move within the group and assistive tech
 * announces one choice — every style here is cosmetic.
 */
export function GenderField({
  value,
  onChange,
  name = "gender",
}: {
  value: Gender | "";
  onChange: (g: Gender) => void;
  name?: string;
}) {
  const tc = useTranslations("Common");

  return (
    <fieldset className="field seg">
      <legend className="field__label">{tc("gender")}</legend>
      <div className="seg__row">
        {OPTIONS.map(({ value: optionValue, labelKey, Icon }) => (
          <label
            key={optionValue}
            className={`seg__opt${value === optionValue ? " seg__opt--on" : ""}`}
          >
            <input
              type="radio"
              name={name}
              value={optionValue}
              checked={value === optionValue}
              onChange={() => onChange(optionValue)}
              data-exclude="true"
            />
            <Icon size={16} aria-hidden="true" />
            <span>{tc(labelKey)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
