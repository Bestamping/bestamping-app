import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const STATIONS = [
  { id: "p1", name: "Plancha 1" },
  { id: "p2", name: "Plancha 2" },
  { id: "p3", name: "Plancha 3" },
  { id: "p4", name: "Plancha 4" },
];

const appBg = "#091224";

function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const stationId = params.get("station") || "p1";

  if (view === "station") {
    return <StationScreen stationId={stationId} />;
  }

  return <AdminScreen />;
}

function AdminScreen() {
  const [guides, setGuides] = useState([]);
  const [selectedStation, setSelectedStation] = useState("p1");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchGuides();

    const channel = supabase
      .channel("guides-realtime-admin")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guides" },
        () => {
          fetchGuides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchGuides() {
    const { data, error } = await supabase
      .from("guides")
      .select("*")
      .order("station", { ascending: true });

    if (error) {
      console.error(error);
      setMessage("Error cargando guías");
      return;
    }

    setGuides(data || []);
  }

  async function handleUpload() {
    setMessage("");

    if (!file) {
      setMessage("Selecciona un archivo.");
      return;
    }

    if (!selectedStation) {
      setMessage("Selecciona una plancha.");
      return;
    }

    setLoading(true);

    try {
      const existingGuide = guides.find((g) => g.station === selectedStation);

      const safeName = file.name.replace(/\s+/g, "_");
      const fileName = `${Date.now()}_${safeName}`;
      const filePath = `uploads/${selectedStation}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("guides")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        console.error(uploadError);
        setMessage(`Error subiendo archivo: ${uploadError.message}`);
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("guides")
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;
      const type = file.type === "application/pdf" ? "pdf" : "image";

      const payload = {
        station: selectedStation,
        title: title.trim() || file.name,
        notes: notes.trim(),
        file_url: fileUrl,
        file_path: filePath,
        type,
        updated_at: new Date().toISOString(),
      };

      const { error: dbError } = await supabase
        .from("guides")
        .upsert(payload, { onConflict: "station" });

      if (dbError) {
        console.error(dbError);
        setMessage(`Error guardando en base de datos: ${dbError.message}`);
        setLoading(false);
        return;
      }

      if (existingGuide?.file_path) {
        const oldPath = existingGuide.file_path;
        if (oldPath !== filePath) {
          await supabase.storage.from("guides").remove([oldPath]);
        }
      }

      setFile(null);
      setTitle("");
      setNotes("");
      const fileInput = document.getElementById("guide-file-input");
      if (fileInput) fileInput.value = "";

      setMessage("Guía subida correctamente.");
      await fetchGuides();
    } catch (err) {
      console.error(err);
      setMessage("Ha ocurrido un error inesperado.");
    }

    setLoading(false);
  }

  async function handleDeleteGuide(guide) {
    const ok = window.confirm(`¿Borrar la guía de ${guide.station}?`);
    if (!ok) return;

    setMessage("");

    if (guide.file_path) {
      const { error: storageError } = await supabase.storage
        .from("guides")
        .remove([guide.file_path]);

      if (storageError) {
        console.error(storageError);
      }
    }

    const { error } = await supabase
      .from("guides")
      .delete()
      .eq("id", guide.id);

    if (error) {
      console.error(error);
      setMessage(`Error borrando guía: ${error.message}`);
      return;
    }

    setMessage("Guía eliminada.");
    fetchGuides();
  }

  const stationMap = useMemo(() => {
    const map = {};
    STATIONS.forEach((s) => {
      map[s.id] = guides.find((g) => g.station === s.id) || null;
    });
    return map;
  }, [guides]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: appBg,
        color: "#fff",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>
          BeStamping · Control de Producción
        </h1>
        <p style={{ opacity: 0.8, marginTop: 0 }}>
          Sube una guía, asígnala a una plancha y muéstrala en una tablet.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            alignItems: "start",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Subir guía</h2>

            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>Plancha</label>
                <select
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  style={inputStyle}
                >
                  {STATIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Título</label>
                <input
                  type="text"
                  placeholder="Ej: Equipación rosa Snickers"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Notas</label>
                <textarea
                  placeholder="Ej: revisar posición del sponsor, prioridad alta..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ ...inputStyle, minHeight: 90, resize: "vertical" }}
                />
              </div>

              <div>
                <label style={labelStyle}>Archivo</label>
                <input
                  id="guide-file-input"
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={inputStyle}
                />
              </div>

              <button
                onClick={handleUpload}
                disabled={loading}
                style={{
                  ...buttonStyle,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Subiendo..." : "Subir guía"}
              </button>

              {message ? (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.06)",
                    fontSize: 14,
                  }}
                >
                  {message}
                </div>
              ) : null}
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <h2 style={{ marginTop: 0 }}>URLs de tablets</h2>

            <div style={{ display: "grid", gap: 12 }}>
              {STATIONS.map((s) => {
                const url = `${window.location.origin}/?view=station&station=${s.id}`;
                return (
                  <div
                    key={s.id}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>
                      {s.name}
                    </div>
                    <div
                      style={{
                        wordBreak: "break-all",
                        fontSize: 13,
                        opacity: 0.8,
                        marginBottom: 10,
                      }}
                    >
                      {url}
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        style={smallButtonStyle}
                        onClick={() => navigator.clipboard.writeText(url)}
                      >
                        Copiar URL
                      </button>
                      <button
                        style={smallButtonStyle}
                        onClick={() => window.open(url, "_blank")}
                      >
                        Abrir
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <h2>Guías activas por plancha</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 20,
            }}
          >
            {STATIONS.map((station) => {
              const guide = stationMap[station.id];

              return (
                <div
                  key={station.id}
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    padding: 16,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>
                        {station.name}
                      </div>
                      {!guide ? (
                        <div style={{ opacity: 0.7, marginTop: 6 }}>
                          Sin guía asignada
                        </div>
                      ) : (
                        <>
                          <div style={{ marginTop: 6, fontWeight: 700 }}>
                            {guide.title}
                          </div>
                          {guide.notes ? (
                            <div style={{ marginTop: 6, opacity: 0.8 }}>
                              {guide.notes}
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>

                    {guide ? (
                      <button
                        onClick={() => handleDeleteGuide(guide)}
                        style={dangerButtonStyle}
                      >
                        Borrar
                      </button>
                    ) : null}
                  </div>

                  {guide ? (
                    <div style={{ marginTop: 16 }}>
                      {guide.type === "image" ? (
                        <img
                          src={guide.file_url}
                          alt={guide.title}
                          style={{
                            width: "100%",
                            maxHeight: 360,
                            objectFit: "contain",
                            background: "#000",
                            borderRadius: 10,
                          }}
                        />
                      ) : (
                        <iframe
                          src={guide.file_url}
                          title={guide.title}
                          style={{
                            width: "100%",
                            height: 360,
                            border: "none",
                            borderRadius: 10,
                            background: "#fff",
                          }}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StationScreen({ stationId }) {
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    fetchGuide();

    const channel = supabase
      .channel("realtime-guides")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guides" },
        fetchGuide
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [stationId]);

  async function fetchGuide() {
    const { data } = await supabase
      .from("guides")
      .select("*")
      .eq("station", stationId)
      .maybeSingle();

    setGuide(data);
    setScale(1);
    setLoading(false);
  }

  function zoomIn() {
    setScale((s) => Math.min(s + 0.3, 5));
  }

  function zoomOut() {
    setScale((s) => Math.max(s - 0.3, 1));
  }

  function reset() {
    setScale(1);
  }

  if (loading) {
    return <div style={center}>Cargando...</div>;
  }

  if (!guide) {
    return <div style={center}>Sin guía</div>;
  }

  return (
    <div style={{ background: "#000", height: "100vh", color: "#fff" }}>
      {/* HEADER */}
      <div style={header}>
        <div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            {stationId.toUpperCase()}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>
            {guide.title}
          </div>
        </div>

        {guide.notes && (
          <div style={{ fontSize: 14 }}>{guide.notes}</div>
        )}
      </div>

      {/* CONTENT */}
      {guide.type === "image" ? (
        <div style={viewer}>
          <div style={controls}>
            <button onClick={zoomOut}>➖</button>
            <button onClick={zoomIn}>➕</button>
            <button onClick={reset}>🔄</button>
          </div>

          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top center",
              width: "fit-content",
              margin: "0 auto",
            }}
          >
            <img
              src={guide.file_url}
              style={{ maxWidth: "none", display: "block" }}
            />
          </div>
        </div>
      ) : (
        <div style={viewer}>
          <a href={guide.file_url} target="_blank" style={pdfBtn}>
            📄 Abrir PDF
          </a>

          <iframe
            src={guide.file_url}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
    </div>
  );
}

const header = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  padding: 10,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  justifyContent: "space-between",
};

const viewer = {
  height: "100%",
  overflow: "auto",
  paddingTop: 70,
};

const controls = {
  position: "fixed",
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  gap: 10,
};

const pdfBtn = {
  position: "fixed",
  top: 80,
  right: 10,
  background: "#fff",
  padding: 10,
  borderRadius: 10,
};

const center = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  background: "#000",
  color: "#fff",
};

export default App;
