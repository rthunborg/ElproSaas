"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { activeNotificationCategories } from "@/server/notifications/registry";

const ACTIVE_CATEGORIES = activeNotificationCategories();

export function NotificationPreferences() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const loadVersion = useRef(0);

  const loadPreferences = useCallback(async () => {
    const requestVersion = ++loadVersion.current;
    try {
      const response = await fetch("/api/notifications/preferences");
      if (!response.ok) throw new Error("Could not load preferences");
      const data = await response.json();
      if (requestVersion !== loadVersion.current) return;
      setEnabled(Object.fromEntries(data.preferences.map((preference: { category: string; enabled: boolean }) => [
        preference.category,
        preference.enabled,
      ])));
    } catch {
      if (requestVersion === loadVersion.current) setError("Kunde inte hämta inställningarna. Försök igen.");
    }
  }, []);

  useEffect(() => {
    const requestVersion = ++loadVersion.current;
    void fetch("/api/notifications/preferences")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load preferences");
        return response.json();
      })
      .then((data) => {
        if (requestVersion !== loadVersion.current) return;
        setEnabled(Object.fromEntries(data.preferences.map((preference: { category: string; enabled: boolean }) => [
          preference.category,
          preference.enabled,
        ])));
      })
      .catch(() => {
        if (requestVersion === loadVersion.current) setError("Kunde inte hämta inställningarna. Försök igen.");
      });
  }, []);

  return (
    <section>
      <h1 className="text-2xl font-semibold">Notisinställningar</h1>
      <p>e-postutskick aktiveras senare</p>
      <fieldset className="mt-4" aria-label="Offerter">
        <legend className="font-semibold">Offerter</legend>
        <table>
          <thead>
            <tr>
              <th scope="col">Kategori</th>
              <th scope="col">I appen</th>
              <th scope="col">E-post</th>
            </tr>
          </thead>
          <tbody>
            {ACTIVE_CATEGORIES.map((category) => {
              const label = "Viktig uppföljning av offert";
              const value = enabled[category.category] ?? category.defaultEnabled;

              return (
                <tr key={category.category}>
                  <th scope="row">
                    {label}
                    {category.essential && <span>Obligatorisk notis</span>}
                  </th>
                  <td>
                    <label>
                      <span className="sr-only">I appen</span>
                      <input
                        role="switch"
                        aria-label={`${label} i appen`}
                        type="checkbox"
                        checked={value}
                        disabled={category.essential || savingCategory === category.category}
                        onChange={async (event) => {
                          const next = event.target.checked;
                          loadVersion.current += 1;
                          setError(null);
                          setSavingCategory(category.category);
                          try {
                            const response = await fetch("/api/notifications/preferences", {
                              method: "PUT",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ category: category.category, channel: "in_app", enabled: next }),
                            });
                            if (!response.ok) throw new Error("Could not save preference");
                            await loadPreferences();
                          } catch {
                            await loadPreferences();
                            setError("Kunde inte spara inställningen. Försök igen.");
                          } finally {
                            setSavingCategory(null);
                          }
                        }}
                      />
                    </label>
                  </td>
                  <td>
                    <input
                      role="switch"
                      aria-label={`${label} e-post`}
                      type="checkbox"
                      disabled
                      readOnly
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </fieldset>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
