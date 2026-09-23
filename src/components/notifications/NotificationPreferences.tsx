"use client";

import { useEffect, useState } from "react";
import { NOTIFICATION_CATEGORIES } from "@/server/notifications/registry";

export function NotificationPreferences() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/notifications/preferences")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load preferences");
        return response.json();
      })
      .then((data) => {
        setEnabled(Object.fromEntries(data.preferences.map((preference: { category: string; enabled: boolean }) => [
          preference.category,
          preference.enabled,
        ])));
      })
      .catch(() => setError("Kunde inte hämta inställningarna. Försök igen."));
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
            {NOTIFICATION_CATEGORIES.map((category) => {
              const label = category.category === "quote.accepted"
                ? "Offert accepterad"
                : "Viktig uppföljning av offert";
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
                        disabled={category.essential}
                        onChange={async (event) => {
                          const next = event.target.checked;
                          const previous = value;
                          setError(null);
                          setEnabled((current) => ({ ...current, [category.category]: next }));
                          try {
                            const response = await fetch("/api/notifications/preferences", {
                              method: "PUT",
                              headers: { "content-type": "application/json" },
                              body: JSON.stringify({ category: category.category, channel: "in_app", enabled: next }),
                            });
                            if (!response.ok) throw new Error("Could not save preference");
                          } catch {
                            setEnabled((current) => ({ ...current, [category.category]: previous }));
                            setError("Kunde inte spara inställningen. Försök igen.");
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
