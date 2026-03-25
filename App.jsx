import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "bestamping-guides-upload-v1";
const MAX_FILE_SIZE_MB = 12;

const initialData = {
  stations: [
    { id: "p1", name: "Plancha 1" },
    { id: "p2", name: "Plancha 2" },
    { id: "p3", name: "Plancha 3" },
    { id: "p4", name: "Plancha 4" },
  ],
  guides: [],
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function styles() {
  return {
    page: {
      minHeight: "100vh",
      background: "#0b1220",
      color: "#ffffff",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
    wrap: {
      maxWidth: 1280,
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
    label: {
      display: "block",
      marginBottom: 8,
      fontSize: 14,
      opacity: 0.9,
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
    buttonDanger: {
      padding: "12px 16px",
      borderRadius: 12,
      border: "1px solid rgba(239,68,68,0.35)",
      cursor: "pointer",
      background: "rgba(127,29,29,0.2)",
      color: "#fca5a5",
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
    helper: {
      fontSize: 13,
      opacity: 0.72,
      marginTop: 6,
      lineHeight: 1.45,
    },
  };
}

function AdminView({ data, setData }) {
  const s = styles();
  const [form, setForm] = useState({
    id: "",
    station: "p1",
    title: "",
    type: "image",
    notes: "",
  });
  const [fileState, setFileState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const sortedGuides = useMemo(() => {
    return [...data.guides].sort((a, b) => a.station.localeCompare(b.station));
  }, [data.guides]);

  function resetForm() {
    setForm({
      id: "",
      station: "p1",
      title: "",
      type: "image",
      notes: "",
    });
    setFileState(null);
    setMessage("");
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    setMessage("");
    if (!file) {
      setFileState(null);
      return;
    }

    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setMessage(`El archivo supera ${MAX_FILE_SIZE_MB} MB.`);
      setFileState(null);
      return;
    }

    const detectedType = file.type === "application/pdf" ? "pdf" : "image";

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setMessage("Solo se permiten imágenes o PDFs.");
      setFileState(null);
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setFileState({
        name: file.name,
        size: file.size,
        mimeType: file.type,
        dataUrl,
      });
      setForm((prev) => ({ ...prev, type: detectedType }));
    } catch {
      setMessage("No se pudo leer el archivo.");
      setFileState(null);
    }
  }

  async function saveGuide() {
    setMessage("");
    if (!form.station || !form.title) {
      setMessage("Completa estación y título.");
      return;
    }

    const editingExisting = Boolean(form.id);
    const existingGuide = data.guides.find((g) => g.id === form.id);

    if (!fileState && !editingExisting) {
      setMessage("Debes subir una imagen o un PDF.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        id: form.id || uid(),
        station: form.station,
        title: form.title,
        type: fileState ? form.type : existingGuide?.type || "image",
        notes: form.notes,
        fileName: fileState ? fileState.name : existingGuide?.fileName || "",
        fileSize: fileState ? fileState.size : existingGuide?.fileSize || 0,
        mimeType: fileState ? fileState.mimeType : existingGuide?.mimeType || "",
        fileData: fileState ? fileState.dataUrl : existingGuide?.fileData || "",
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
      setMessage("Guía guardada correctamente.");
    } finally {
      setSaving(false);
    }
  }

  function editGuide(guide) {
    setForm({
      id: guide.id,
      station: guide.station,
      title: guide.title,
      type: guide.type,
      notes: guide.notes || "",
    });
    setFileState({
      name: guide.fileName,
      size: guide.fileSize,
      mimeType: guide.mimeType,
      dataUrl: guide.fileData,
    });
    setMessage("");
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

  function clearAll() {
    const next = { ...data, guides: [] };
    setData(next);
    saveData(next);
    resetForm();
    setMessage("Todas las guías se han eliminado.");
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
            <div style={{ marginTop: 8, opacity: 0.75, lineHeight: 1.5 }}>
              Sube una imagen o un PDF desde tu ordenador y asígnalo a una tablet.
            </div>
          </div>
          <button style={s.buttonDanger} onClick={clearAll}>
            Borrar todas las guías
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 1.05fr) minmax(300px, 0.95fr)",
            gap: 20,
          }}
        >
          <div style={s.card}>
            <h2 style={{ marginTop: 0 }}>Subir guía a una estación</h2>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={s.label}>Estación</label>
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
                <label style={s.label}>Título</label>
                <input
                  style={s.input}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej: Camiseta rosa sponsor Snickers"
                />
              </div>

              <div>
                <label style={s.label}>Archivo</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  style={s.input}
                  onChange={handleFileChange}
                />
                <div style={s.helper}>
                  Puedes subir una imagen o PDF directamente desde tu ordenador. Límite recomendado: {MAX_FILE_SIZE_MB} MB.
                </div>
                {fileState ? (
                  <div style={{ ...s.helper, color: "#c7d2fe" }}>
                    Archivo cargado: <strong>{fileState.name}</strong> · {formatBytes(fileState.size)}
                  </div>
                ) : null}
              </div>

              <div>
                <label style={s.label}>Tipo detectado</label>
                <input style={s.input} value={form.type === "pdf" ? "PDF" : "Imagen"} readOnly />
              </div>

              <div>
                <label style={s.label}>Notas</label>
                <textarea
                  style={s.textarea}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Observaciones para el operario"
                />
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={s.button} onClick={saveGuide} disabled={saving}>
                  {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Asignar guía"}
                </button>
                <button style={s.buttonAlt} onClick={resetForm}>
                  Limpiar
                </button>
              </div>

              {message ? <div style={{ ...s.helper, color: "#fde68a" }}>{message}</div> : null}

              <div
                style={{
                  marginTop: 6,
                  padding: 14,
                  borderRadius: 14,
                  background: "rgba(251,191,36,0.08)",
                  border: "1px solid rgba(251,191,36,0.2)",
                  lineHeight: 1.5,
                  fontSize: 14,
                }}
              >
                Esta versión guarda los archivos dentro del navegador con <strong>localStorage</strong>. Sirve para pruebas y demo, pero <strong>no sincroniza entre tablets distintas</strong>. Para uso real multi-tablet hay que pasar al siguiente paso: almacenamiento compartido.
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
                        src={guide.fileData}
                        alt={guide.title}
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    ) : (
                      <div style={{ padding: 12, textAlign: "center", opacity: 0.85 }}>
                        <div style={{ fontSize: 48 }}>📄</div>
                        <div>PDF</div>
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 8 }}>{guide.fileName}</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 20 }}>{guide.title}</strong>
                      <span style={s.badge}>{guide.station}</span>
                      <span style={s.badge}>{guide.type === "image" ? "Imagen" : "PDF"}</span>
                    </div>
                    <div style={{ opacity: 0.8, marginTop: 8 }}>{guide.fileName}</div>
                    <div style={{ opacity: 0.65, marginTop: 6, fontSize: 13 }}>{formatBytes(guide.fileSize)}</div>
                    {guide.notes ? <div style={{ marginTop: 10, opacity: 0.9 }}>{guide.notes}</div> : null}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <button style={s.buttonAlt} onClick={() => editGuide(guide)}>
                      Editar
                    </button>
                    <button style={s.buttonDanger} onClick={() => deleteGuide(guide.id)}>
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
          src={guide.fileData}
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
        src={guide.fileData}
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
