import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bestamping-guides-v1";

const initialData = {
  stations: [
    { id: "p1", name: "Plancha 1" },
    { id: "p2", name: "Plancha 2" },
    { id: "p3", name: "Plancha 3" },
    { id: "p4", name: "Plancha 4" },
  ],
  guides: [
    {
      id: "g1",
      station: "p1",
      title: "Guía camiseta rosa",
      type: "image",
      file: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1200&auto=format&fit=crop",
      notes: "Revisar posición del logo y orden de prendas.",
      updatedAt: new Date().toISOString(),
    },
    {
      id: "g2",
      station: "p2",
      title: "Guía equipación azul",
      type: "pdf",
      file: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
      notes: "Seguir exactamente la referencia enviada.",
      updatedAt: new Date().toISOString(),
    },
  ],
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : initialData;
  } catch {
    return initialData;
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function appStyles() {
  return {
    page: {
      minHeight: "100vh",
      background: "#0b1220",
      color: "#ffffff",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    wrap: {
      maxWidth: 1200,
      margin: "0 auto",
      padding: 24,
    },
    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 18,
      padding: 18,
      boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
    },
    input: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(0,0,0,0.18)",
      color: "#fff",
      outline: "none",
      boxSizing: "border-box",
    },
    textarea: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "rgba(0,0,0,0.18)",
      color: "#fff",
      outline: "none",
      boxSizing: "border-box",
      minHeight: 100,
      resize: "vertical",
    },
    select: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.12)",
      background: "#111827",
      color: "#fff",
      outline: "none",
      boxSizing: "border-box",
    },
    button: {
      padding: "12px 16px",
      borderRadius: 12,
      border: "none",
      cursor: "pointer",
      background: "#ffffff",
      color: "#111827",
      fontWeight: 700,
    },
    buttonAlt: {
      padding: "12px 16px",
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.12)",
      cursor: "pointer",
      background: "rgba(255,255,255,0.06)",
      color: "#fff",
      fontWeight: 600,
    },
    badge: {
      display: "inline-block",
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      background: "rgba(255,255,255,0.08)",
      border: "1px solid rgba(255,255,255,0.08)",
      color: "#d1d5db",
    },
  };
}

function AdminView({ data, setData }) {
  const s = appStyles();

  const [form, setForm] = useState({
    id: "",
    station: "p1",
    title: "",
    type: "image",
    file: "",
    notes: "",
  });

  const sortedGuides = useMemo(() => {
    return [...data.guides].sort((a, b) => {
      return a.station.localeCompare(b.station);
    });
  }, [data.guides]);

  function resetForm() {
    setForm({
      id: "",
      station: "p1",
      title: "",
      type: "image",
      file: "",
      notes: "",
    });
  }

  function saveGuide() {
    if (!form.station || !form.title || !form.type || !form.file) {
      alert("Completa estación, título, tipo y URL.");
      return;
    }

    const payload = {
      id: form.id || uid(),
      station: form.station,
      title: form.title,
      type: form.type,
      file: form.file,
      notes: form.notes,
      updatedAt: new Date().toISOString(),
    };

    let nextGuides;
    const exists = data.guides.some((g) => g.id === payload.id);

    if (exists) {
      nextGuides = data.guides.map((g) => (g.id === payload.id ? payload : g));
    } else {
      const withoutSameStation = data.guides.filter((g) => g.station !== payload.station);
      nextGuides = [payload, ...withoutSameStation];
    }

    const next = { ...data, guides: nextGuides };
    setData(next);
    saveData(next);
    resetForm();
  }

  function editGuide(guide) {
    setForm({
      id: guide.id,
      station: guide.station,
      title: guide.title,
      type: guide.type,
      file: guide.file,
      notes: guide.notes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteGuide(id) {
    const next = {
      ...data,
      guides: data.guides.filter((g) => g.id !== id),
    };
    setData(next);
    saveData(next);
  }

  function loadDemo() {
    setData(initialData);
    saveData(initialData);
  }

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "center",
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ opacity: 0.65, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
              Bestamping
            </div>
            <h1 style={{ margin: "6px 0 0 0", fontSize: 34 }}>Panel de guías de estampación</h1>
          </div>
          <button style={s.buttonAlt} onClick={loadDemo}>
            Cargar demo
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 20,
          }}
        >
          <div style={s.card}>
            <h2 style={{ marginTop: 0 }}>Asignar guía a una tablet</h2>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label>Estación</label>
                <select
                  style={s.select}
                  value={form.station}
                  onChange={(e) => setForm({ ...form, station: e.target.value })}
                >
                  {data.stations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Título</label>
                <input
                  style={s.input}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej: Camiseta rosa sponsor Snickers"
                />
              </div>

              <div>
                <label>Tipo de archivo</label>
                <select
                  style={s.select}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="image">Imagen</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>

              <div>
                <label>URL de la imagen o PDF</label>
                <input
                  style={s.input}
                  value={form.file}
                  onChange={(e) => setForm({ ...form, file: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <label>Notas</label>
                <textarea
                  style={s.textarea}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Observaciones para el operario"
                />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={s.button} onClick={saveGuide}>
                  {form.id ? "Guardar cambios" : "Asignar guía"}
                </button>
                <button style={s.buttonAlt} onClick={resetForm}>
                  Limpiar
                </button>
              </div>
            </div>
          </div>

          <div style={s.card}>
            <h2 style={{ marginTop: 0 }}>URLs para las tablets</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {data.stations.map((st) => {
                const url = `${window.location.origin}${window.location.pathname}?view=station&station=${st.id}`;
                return (
                  <div
                    key={st.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14,
                      padding: 14,
                      background: "rgba(0,0,0,0.16)",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>{st.name}</div>
                    <div
                      style={{
                        fontSize: 13,
                        opacity: 0.8,
                        wordBreak: "break-all",
                        marginBottom: 10,
                      }}
                    >
                      {url}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button style={s.buttonAlt} onClick={() => window.open(url, "_blank")}>
                        Abrir
                      </button>
                      <button
                        style={s.buttonAlt}
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          alert("URL copiada");
                        }}
                      >
                        Copiar URL
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ height: 20 }} />

        <div style={s.card}>
          <h2 style={{ marginTop: 0 }}>Guías activas</h2>

          {sortedGuides.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No hay guías asignadas todavía.</div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {sortedGuides.map((guide) => (
                <div
                  key={guide.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: 16,
                    background: "rgba(0,0,0,0.16)",
                    display: "grid",
                    gridTemplateColumns: "220px 1fr auto",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      height: 140,
                      borderRadius: 12,
                      overflow: "hidden",
                      background: "#000",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {guide.type === "image" ? (
                      <img
                        src={guide.file}
                        alt={guide.title}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <div style={{ padding: 12, textAlign: "center", opacity: 0.85 }}>
                        <div style={{ fontSize: 48 }}>📄</div>
                        <div>PDF</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 20 }}>{guide.title}</strong>
                      <span style={s.badge}>{guide.station}</span>
                      <span style={s.badge}>{guide.type === "image" ? "Imagen" : "PDF"}</span>
                    </div>
                    <div style={{ opacity: 0.8, marginTop: 8, wordBreak: "break-all" }}>{guide.file}</div>
                    {guide.notes ? <div style={{ marginTop: 10, opacity: 0.9 }}>{guide.notes}</div> : null}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button style={s.buttonAlt} onClick={() => editGuide(guide)}>
                      Editar
                    </button>
                    <button
                      style={{ ...s.buttonAlt, borderColor: "rgba(239,68,68,0.35)", color: "#fca5a5" }}
                      onClick={() => deleteGuide(guide.id)}
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StationView({ data, stationId }) {
  const guide = data.guides.find((g) => g.station === stationId);
  const station = data.stations.find((s) => s.id === stationId);

  useEffect(() => {
    const interval = setInterval(() => {
      const latest = loadData();
      const currentSerialized = JSON.stringify(data);
      const latestSerialized = JSON.stringify(latest);
      if (latestSerialized !== currentSerialized) {
        window.location.reload();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [data]);

  if (!guide) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#000",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 20, opacity: 0.7, marginBottom: 10 }}>
          {station ? station.name : stationId}
        </div>
        <div style={{ fontSize: 40, fontWeight: 700 }}>Sin guía asignada</div>
      </div>
    );
  }

  if (guide.type === "pdf") {
    return (
      <div
        style={{
          width: "100%",
          height: "100vh",
          background: "#111",
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            position: "fixed",
            top: 12,
            left: 12,
            right: 12,
            zIndex: 20,
            background: "rgba(0,0,0,0.55)",
            color: "#fff",
            borderRadius: 14,
            padding: "10px 14px",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            backdropFilter: "blur(8px)",
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>{guide.title}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{station?.name}</div>
          </div>
          {guide.notes ? <div style={{ fontSize: 13, opacity: 0.9 }}>{guide.notes}</div> : null}
        </div>

        <iframe
          title={guide.title}
          src={guide.file}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            background: "#fff",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "#000",
        position: "relative",
        overflow: "hidden",
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          right: 12,
          zIndex: 20,
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          borderRadius: 14,
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          backdropFilter: "blur(8px)",
        }}
      >
        <div>
          <div style={{ fontWeight: 700 }}>{guide.title}</div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>{station?.name}</div>
        </div>
        {guide.notes ? <div style={{ fontSize: 13, opacity: 0.9 }}>{guide.notes}</div> : null}
      </div>

      <img
        src={guide.file}
        alt={guide.title}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          display: "block",
        }}
      />
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(loadData());

  useEffect(() => {
    saveData(data);
  }, [data]);

  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const stationId = params.get("station") || "p1";

  if (view === "station") {
    return <StationView data={data} stationId={stationId} />;
  }

  return <AdminView data={data} setData={setData} />;
}
