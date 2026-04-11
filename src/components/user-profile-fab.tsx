"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

type ProfilePayload = {
  fullName: string;
  email: string;
  isParticipant: boolean;
  roles: string[];
  photoDataUrl: string;
  participantName: string;
};

const emptyProfile: ProfilePayload = {
  fullName: "",
  email: "",
  isParticipant: false,
  roles: [],
  photoDataUrl: "",
  participantName: "",
};

export function UserProfileFab() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<ProfilePayload>(emptyProfile);
  const [draft, setDraft] = useState({
    fullName: "",
    email: "",
    password: "",
    photoDataUrl: "",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setIsLoading(true);
        const response = await fetch("/api/profile/me", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Nao foi possivel carregar o perfil.");
        }

        const data = (await response.json()) as ProfilePayload;

        if (cancelled) {
          return;
        }

        setProfile(data);
        setDraft({
          fullName: data.fullName,
          email: data.email,
          password: "",
          photoDataUrl: data.photoDataUrl ?? "",
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Erro ao carregar o perfil.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  const avatarLabel = useMemo(() => {
    const source = draft.fullName || profile.fullName || profile.email;
    return source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [draft.fullName, profile.fullName, profile.email]);

  async function handleSave() {
    try {
      setIsSaving(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/profile/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: draft.fullName,
          email: draft.email,
          password: draft.password,
          photoDataUrl: draft.photoDataUrl,
        }),
      });

      const data = (await response.json()) as
        | (ProfilePayload & { success: true })
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : "Nao foi possivel salvar.");
      }

      const nextProfile: ProfilePayload = {
        fullName: data.fullName,
        email: data.email,
        isParticipant: data.isParticipant,
        roles: data.roles,
        photoDataUrl: data.photoDataUrl,
        participantName: data.participantName,
      };

      setProfile(nextProfile);
      setDraft((current) => ({
        ...current,
        fullName: nextProfile.fullName,
        email: nextProfile.email,
        password: "",
        photoDataUrl: nextProfile.photoDataUrl,
      }));
      setMessage("Perfil atualizado com sucesso.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar o perfil.");
    } finally {
      setIsSaving(false);
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setDraft((current) => ({ ...current, photoDataUrl: result }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <>
      <button
        aria-label="Abrir perfil"
        className="fixed right-4 top-4 z-[70] flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-[rgba(255,208,101,0.22)] bg-[linear-gradient(180deg,rgba(16,52,38,0.96),rgba(7,24,18,0.98))] shadow-[0_18px_40px_rgba(0,0,0,0.32)] transition hover:scale-[1.02] hover:border-[rgba(255,208,101,0.38)] md:right-6 md:top-6"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {draft.photoDataUrl ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${draft.photoDataUrl})` }}
          />
        ) : (
          <span className="text-sm font-semibold tracking-[0.12em] text-[rgba(255,236,184,0.96)]">
            {avatarLabel || "PF"}
          </span>
        )}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-end bg-[rgba(2,10,7,0.48)] p-4 backdrop-blur-[3px] md:p-6">
          <button
            aria-label="Fechar perfil"
            className="absolute inset-0"
            onClick={() => setIsOpen(false)}
            type="button"
          />

          <section className="relative z-10 flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-[1.6rem] border border-[rgba(255,208,101,0.16)] bg-[linear-gradient(180deg,rgba(12,44,31,0.98),rgba(7,24,18,1))] shadow-[0_28px_60px_rgba(0,0,0,0.42)]">
            <div className="flex items-start justify-between gap-4 border-b border-[rgba(255,208,101,0.1)] px-5 py-5">
              <div>
                <p className="text-[0.72rem] uppercase tracking-[0.24em] text-[rgba(236,225,196,0.5)]">
                  Minha conta
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[rgba(255,244,214,0.96)]">
                  Perfil do usuario
                </h2>
              </div>

              <button
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(255,208,101,0.14)] bg-[rgba(7,24,18,0.8)] text-lg font-semibold text-[rgba(255,244,214,0.8)]"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                X
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5">
              {isLoading ? (
                <p className="text-sm text-[rgba(236,225,196,0.74)]">Carregando perfil...</p>
              ) : (
                <div className="grid gap-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[rgba(255,208,101,0.18)] bg-[rgba(255,183,32,0.12)]">
                      {draft.photoDataUrl ? (
                        <div
                          className="h-full w-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${draft.photoDataUrl})` }}
                        />
                      ) : (
                        <span className="text-xl font-semibold text-[rgba(255,236,184,0.96)]">
                          {avatarLabel || "PF"}
                        </span>
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="text-base font-semibold text-[rgba(255,244,214,0.96)]">
                        {profile.fullName || "Usuario"}
                      </p>
                      <p className="mt-1 text-sm text-[rgba(236,225,196,0.68)]">{profile.email}</p>
                      <button
                        className="mt-3 rounded-full border border-[rgba(255,208,101,0.14)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[rgba(255,236,184,0.92)]"
                        onClick={() => fileInputRef.current?.click()}
                        type="button"
                      >
                        Alterar foto
                      </button>
                      <input
                        ref={fileInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoChange}
                        type="file"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-[1.15rem] border border-[rgba(255,208,101,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.48)]">
                      Funcoes no sistema
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {profile.roles.map((role) => (
                        <span
                          key={role}
                          className="rounded-full border border-[rgba(255,208,101,0.16)] bg-[rgba(255,183,32,0.1)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[rgba(255,236,184,0.96)]"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-[rgba(236,225,196,0.68)]">
                      {profile.isParticipant
                        ? `Vinculado ao participante: ${profile.participantName || profile.fullName}`
                        : "Sua conta ainda nao esta vinculada a um participante do campeonato."}
                    </p>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.52)]">
                      Nome completo
                    </span>
                    <input
                      className="rounded-[1rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(5,17,12,0.78)] px-4 py-3 text-sm text-[rgba(255,244,214,0.96)] outline-none transition focus:border-[rgba(255,208,101,0.34)]"
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, fullName: event.target.value }))
                      }
                      value={draft.fullName}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.52)]">
                      Email
                    </span>
                    <input
                      className="rounded-[1rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(5,17,12,0.78)] px-4 py-3 text-sm text-[rgba(255,244,214,0.96)] outline-none transition focus:border-[rgba(255,208,101,0.34)]"
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, email: event.target.value }))
                      }
                      type="email"
                      value={draft.email}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-[rgba(236,225,196,0.52)]">
                      Nova senha
                    </span>
                    <input
                      className="rounded-[1rem] border border-[rgba(255,208,101,0.14)] bg-[rgba(5,17,12,0.78)] px-4 py-3 text-sm text-[rgba(255,244,214,0.96)] outline-none transition focus:border-[rgba(255,208,101,0.34)]"
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder="Preencha apenas se quiser alterar"
                      type="password"
                      value={draft.password}
                    />
                  </label>

                  {error ? (
                    <p className="rounded-[1rem] border border-[rgba(255,120,120,0.18)] bg-[rgba(120,20,20,0.2)] px-4 py-3 text-sm text-[rgba(255,209,209,0.95)]">
                      {error}
                    </p>
                  ) : null}

                  {message ? (
                    <p className="rounded-[1rem] border border-[rgba(72,193,122,0.18)] bg-[rgba(25,92,55,0.3)] px-4 py-3 text-sm text-[rgba(218,255,232,0.95)]">
                      {message}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="border-t border-[rgba(255,208,101,0.1)] px-5 py-4">
              <button
                className="w-full rounded-[1rem] bg-[linear-gradient(180deg,#ffd766,#e0aa16)] px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#142b1d] shadow-[0_12px_24px_rgba(224,170,22,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSaving || isLoading}
                onClick={() => void handleSave()}
                type="button"
              >
                {isSaving ? "Salvando..." : "Salvar perfil"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
