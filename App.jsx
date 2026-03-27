import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

const STATIONS = [
  { id: "plancha1", name: "Plancha 1" },
  { id: "plancha2", name: "Plancha 2" },
  { id: "plancha3", name: "Plancha 3" },
];

const STATUS_LABELS = {
  pending: "En cola",
  in_progress: "En proceso",
  done: "Finalizado",
};

export default function App() {
  const [mode, setMode] = useState("manager"); // manager | operator
  const [selectedStation, setSelectedStation] = useState("plancha1");

  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [station, setStation] = useState("plancha1");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [activeJob, setActiveJob] = useState(null);
  const [imageZoom, setImageZoom] = useState(1);

  useEffect(() => {
    fetchJobs();
    const channel = supabase
      .channel("production-jobs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_jobs" },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const jobsByStation = useMemo(() => {
    const grouped = {
      plancha1: [],
      plancha2: [],
      plancha3: [],
    };

    const sorted = [...jobs].sort((a, b) => {
      const aOrder = a.sort_order ?? 0;
      const bOrder = b.sort_order ?? 0;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(a.created_at) - new Date(b.created_at);
    });

    for (const job of sorted) {
      if (grouped[job.station]) grouped[job.station].push(job);
    }

    return grouped;
  }, [jobs]);

  const stationJobs = jobsByStation[selectedStation] || [];

  async function fetchJobs() {
    setLoadingJobs(true);
    const { data, error } = await supabase
      .from("production_jobs")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error loading jobs:", error);
    } else {
      setJobs(data || []);
    }
    setLoadingJobs(false);
  }

  async function getNextSortOrder(stationId) {
    const stationList = jobs.filter((j) => j.station === stationId);
    if (!stationList.length) return 1;
    return Math.max(...stationList.map((j) => j.sort_order || 0)) + 1;
  }

  async function handleUpload(e) {
    e.preventDefault();

    if (!title.trim()) {
      alert("Pon un título al trabajo.");
      return;
    }

    if (!file) {
      alert("Selecciona un archivo.");
      return;
    }

    try {
      setUploading(true);

      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const safeName = file.name.replace(/\s+/g, "_");
      const filePath = `${station}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from("job-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const nextSortOrder = await getNextSortOrder(station);

      const { error: insertError } = await supabase
        .from("production_jobs")
        .insert({
          title: title.trim(),
          notes: notes.trim() || null,
          station,
          file_path: filePath,
          file_name: file.name,
          file_type: file.type || `application/${ext}`,
          status: "pending",
          sort_order: nextSortOrder,
        });

      if (insertError) throw insertError;

      setTitle("");
      setNotes("");
      setStation("plancha1");
      setFile(null);

      const input = document.getElementById("file-input");
      if (input) input.value = "";

      await fetchJobs();
      alert("Trabajo enviado a la cola.");
    } catch (error) {
      console.error(error);
      alert("Error al subir el trabajo.");
    } finally {
      setUploading(false);
    }
  }

  function getPublicUrl(path) {
    const { data } = supabase.storage.from("job-files").getPublicUrl(path);
    return data?.publicUrl || "";
  }

  async function startJob(job) {
    const { error } = await supabase
      .from("production_jobs")
      .update({ status: "in_progress" })
      .eq("id", job.id);

    if (error) {
      console.error(error);
      alert("No se pudo marcar como en proceso.");
      return;
    }

    setActiveJob(job);
    await fetchJobs();
  }

  async function finalizeJob(job) {
    const ok = window.confirm(
      `¿Finalizar y borrar "${job.title}" de la cola?`
    );
    if (!ok) return;

    try {
      const { error: storageError } = await supabase.storage
        .from("job-files")
        .remove([job.file_path]);

      if (storageError) {
        console.warn("No se pudo borrar el archivo del storage:", storageError);
      }

      const { error: deleteError } = await supabase
        .from("production_jobs")
        .delete()
        .eq("id", job.id);

      if (deleteError) throw deleteError;

      if (activeJob?.id === job.id) {
        setActiveJob(null);
        setImageZoom(1);
      }

      await normalizeQueue(job.station);
      await fetchJobs();
    } catch (error) {
      console.error(error);
      alert("No se pudo finalizar el trabajo.");
    }
  }

  async function normalizeQueue(stationId) {
    const list = [...jobs]
      .filter((j) => j.station === stationId)
      .sort((a, b) => {
        const aOrder = a.sort_order ?? 0;
        const bOrder = b.sort_order ?? 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return new Date(a.created_at) - new Date(b.created_at);
      });

    for (let i = 0; i < list.length; i++) {
      const desiredOrder = i + 1;
      if (list[i].sort_order !== desiredOrder) {
        await supabase
          .from("production_jobs")
          .update({ sort_order: desiredOrder })
          .eq("id", list[i].id);
      }
    }
  }

  async function moveJob(job, direction) {
    const stationList = [...stationJobs];
    const index = stationList.findIndex((j) => j.id === job.id);
    if (index === -1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stationList.length) return;

    const currentJob = stationList[index];
    const targetJob = stationList[targetIndex];

    const currentOrder = currentJob.sort_order;
    const targetOrder = targetJob.sort_order;

    try {
      await supabase
        .from("production_jobs")
        .update({ sort_order: -999999 })
        .eq("id", currentJob.id);

      await supabase
        .from("production_jobs")
        .update({ sort_order: currentOrder })
        .eq("id", targetJob.id);

      await supabase
        .from("production_jobs")
        .update({ sort_order: targetOrder })
        .eq("id", currentJob.id);

      await fetchJobs();
    } catch (error) {
      console.error(error);
      alert("No se pudo mover el trabajo.");
    }
  }

  function openJob(job) {
    setActiveJob(job);
    setImageZoom(1);
  }

  function closeViewer() {
    setActiveJob(null);
    setImageZoom(1);
  }

  function isImage(job) {
    return job?.file_type?.startsWith("image/");
  }

  function isPdf(job) {
    return (
      job?.file_type === "application/pdf" ||
      job?.file_name?.toLowerCase().endsWith(".pdf")
    );
  }

  const activeJobUrl = activeJob ? getPublicUrl(activeJob.file_path) : "";

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Production Queue</h1>
          <p style={styles.subtitle}>Cola de trabajos por plancha</p>
        </div>

        <div style={styles.topButtons}>
          <button
            style={{
              ...styles.modeButton,
              ...(mode === "manager" ? styles.modeButtonActive : {}),
            }}
            onClick={() => setMode("manager")}
          >
            Gestor
          </button>
          <button
            style={{
              ...styles.modeButton,
              ...(mode === "operator" ? styles.modeButtonActive : {}),
            }}
            onClick={() => setMode("operator")}
          >
            Operario
          </button>
        </div>
      </header>

      <div style={styles.main}>
        {mode === "manager" ? (
          <div style={styles.managerLayout}>
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Nuevo trabajo</h2>

              <form onSubmit={handleUpload} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>Título</label>
                  <input
                    style={styles.input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Escudo camiseta infantil"
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Notas</label>
                  <textarea
                    style={styles.textarea}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Indicaciones, tallas, posición, observaciones..."
                  />
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Plancha</label>
                  <select
                    style={styles.input}
                    value={station}
                    onChange={(e) => setStation(e.target.value)}
                  >
                    {STATIONS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.field}>
                  <label style={styles.label}>Archivo (JPG, PNG, PDF)</label>
                  <input
                    id="file-input"
                    style={styles.input}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf,image/*,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>

                <button
                  type="submit"
                  style={styles.primaryButton}
                  disabled={uploading}
                >
                  {uploading ? "Subiendo..." : "Enviar a la cola"}
                </button>
              </form>
            </section>

            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Resumen de colas</h2>

              <div style={styles.stationSummaryGrid}>
                {STATIONS.map((s) => {
                  const list = jobsByStation[s.id] || [];
                  const pending = list.filter((j) => j.status === "pending").length;
                  const inProgress = list.filter((j) => j.status === "in_progress").length;

                  return (
                    <div key={s.id} style={styles.summaryBox}>
                      <div style={styles.summaryTitle}>{s.name}</div>
                      <div style={styles.summaryStat}>Total: {list.length}</div>
                      <div style={styles.summaryStat}>En cola: {pending}</div>
                      <div style={styles.summaryStat}>En proceso: {inProgress}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 20 }}>
                {loadingJobs ? (
                  <p>Cargando trabajos...</p>
                ) : jobs.length === 0 ? (
                  <p>No hay trabajos en cola.</p>
                ) : (
                  <div style={styles.managerJobList}>
                    {jobs.map((job) => (
                      <div key={job.id} style={styles.jobRow}>
                        <div>
                          <div style={styles.jobTitle}>{job.title}</div>
                          <div style={styles.jobMeta}>
                            {stationName(job.station)} · {STATUS_LABELS[job.status]}
                          </div>
                        </div>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => openJob(job)}
                        >
                          Ver
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div style={styles.operatorLayout}>
            <aside style={styles.sidebar}>
              <h2 style={styles.sectionTitle}>Planchas</h2>
              <div style={styles.stationTabs}>
                {STATIONS.map((s) => (
                  <button
                    key={s.id}
                    style={{
                      ...styles.stationTab,
                      ...(selectedStation === s.id ? styles.stationTabActive : {}),
                    }}
                    onClick={() => {
                      setSelectedStation(s.id);
                      setActiveJob(null);
                      setImageZoom(1);
                    }}
                  >
                    {s.name}
                    <span style={styles.badge}>
                      {jobsByStation[s.id]?.length || 0}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <section style={styles.queuePanel}>
              <div style={styles.queueHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>
                    Cola {stationName(selectedStation)}
                  </h2>
                  <p style={styles.muted}>
                    El operario puede elegir cualquier trabajo de la cola.
                  </p>
                </div>
              </div>

              <div style={styles.queueList}>
                {loadingJobs ? (
                  <p>Cargando cola...</p>
                ) : stationJobs.length === 0 ? (
                  <p>No hay trabajos para esta plancha.</p>
                ) : (
                  stationJobs.map((job, index) => (
                    <div key={job.id} style={styles.queueItem}>
                      <div style={styles.queueNumber}>{index + 1}</div>

                      <div style={{ flex: 1 }}>
                        <div style={styles.jobTitle}>{job.title}</div>
                        <div style={styles.jobMeta}>
                          {STATUS_LABELS[job.status]} · {job.file_name}
                        </div>
                        {job.notes ? (
                          <div style={styles.jobNotes}>{job.notes}</div>
                        ) : null}
                      </div>

                      <div style={styles.queueActions}>
                        <button
                          style={styles.smallButton}
                          onClick={() => moveJob(job, "up")}
                          disabled={index === 0}
                        >
                          ↑
                        </button>
                        <button
                          style={styles.smallButton}
                          onClick={() => moveJob(job, "down")}
                          disabled={index === stationJobs.length - 1}
                        >
                          ↓
                        </button>
                        <button
                          style={styles.secondaryButton}
                          onClick={() => openJob(job)}
                        >
                          Abrir
                        </button>
                        {job.status === "pending" && (
                          <button
                            style={styles.primaryButton}
                            onClick={() => startJob(job)}
                          >
                            Empezar
                          </button>
                        )}
                        {job.status === "in_progress" && (
                          <button
                            style={styles.dangerButton}
                            onClick={() => finalizeJob(job)}
                          >
                            Finalizar
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {activeJob && (
        <div style={styles.modalOverlay} onClick={closeViewer}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={{ margin: 0 }}>{activeJob.title}</h3>
                <p style={{ margin: "6px 0 0", color: "#666" }}>
                  {activeJob.file_name}
                </p>
              </div>

              <div style={styles.viewerControls}>
                {isImage(activeJob) && (
                  <>
                    <button
                      style={styles.smallButton}
                      onClick={() =>
                        setImageZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))
                      }
                    >
                      -
                    </button>
                    <span style={styles.zoomLabel}>{Math.round(imageZoom * 100)}%</span>
                    <button
                      style={styles.smallButton}
                      onClick={() =>
                        setImageZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))
                      }
                    >
                      +
                    </button>
                  </>
                )}

                {isPdf(activeJob) && (
                  <a
                    href={activeJobUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={styles.linkButton}
                  >
                    Abrir PDF
                  </a>
                )}

                {activeJob.status === "pending" && mode === "operator" && (
                  <button
                    style={styles.primaryButton}
                    onClick={() => startJob(activeJob)}
                  >
                    Empezar
                  </button>
                )}

                {activeJob.status === "in_progress" && mode === "operator" && (
                  <button
                    style={styles.dangerButton}
                    onClick={() => finalizeJob(activeJob)}
                  >
                    Finalizar
                  </button>
                )}

                <button style={styles.secondaryButton} onClick={closeViewer}>
                  Cerrar
                </button>
              </div>
            </div>

            <div style={styles.viewerArea}>
              {isImage(activeJob) ? (
                <div style={styles.imageWrap}>
                  <img
                    src={activeJobUrl}
                    alt={activeJob.title}
                    style={{
                      ...styles.viewerImage,
                      transform: `scale(${imageZoom})`,
                    }}
                  />
                </div>
              ) : isPdf(activeJob) ? (
                <iframe
                  title={activeJob.title}
                  src={activeJobUrl}
                  style={styles.viewerIframe}
                />
              ) : (
                <div style={styles.unsupported}>
                  No se puede previsualizar este tipo de archivo.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function stationName(id) {
  return STATIONS.find((s) => s.id === id)?.name || id;
}

const styles = {
  app: {
    minHeight: "100vh",
    background: "#f3f4f6",
    color: "#111827",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  header: {
    padding: "20px 24px",
    background: "#111827",
    color: "white",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 20,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 700,
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#d1d5db",
  },
  topButtons: {
    display: "flex",
    gap: 10,
  },
  modeButton: {
    border: "1px solid #374151",
    background: "#1f2937",
    color: "white",
    padding: "10px 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600,
  },
  modeButtonActive: {
    background: "#2563eb",
    borderColor: "#2563eb",
  },
  main: {
    padding: 24,
  },
  managerLayout: {
    display: "grid",
    gridTemplateColumns: "420px 1fr",
    gap: 24,
  },
  operatorLayout: {
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: 24,
  },
  sidebar: {
    background: "white",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    height: "fit-content",
  },
  card: {
    background: "white",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: 16,
    fontSize: 22,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontWeight: 600,
  },
  input: {
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    background: "white",
  },
  textarea: {
    border: "1px solid #d1d5db",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 14,
    minHeight: 100,
    resize: "vertical",
    background: "white",
  },
  primaryButton: {
    border: "none",
    background: "#2563eb",
    color: "white",
    padding: "12px 16px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
  },
  secondaryButton: {
    border: "1px solid #d1d5db",
    background: "white",
    color: "#111827",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 600,
  },
  dangerButton: {
    border: "none",
    background: "#dc2626",
    color: "white",
    padding: "10px 14px",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
  },
  smallButton: {
    border: "1px solid #d1d5db",
    background: "white",
    color: "#111827",
    padding: "8px 10px",
    borderRadius: 10,
    cursor: "pointer",
    fontWeight: 700,
    minWidth: 38,
  },
  stationSummaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
  },
  summaryBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 16,
    background: "#fafafa",
  },
  summaryTitle: {
    fontWeight: 700,
    marginBottom: 8,
  },
  summaryStat: {
    color: "#4b5563",
    marginBottom: 4,
  },
  managerJobList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  jobRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 14,
  },
  jobTitle: {
    fontWeight: 700,
    fontSize: 16,
  },
  jobMeta: {
    color: "#6b7280",
    marginTop: 4,
    fontSize: 14,
  },
  jobNotes: {
    marginTop: 8,
    color: "#374151",
    fontSize: 14,
  },
  stationTabs: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  stationTab: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    border: "1px solid #e5e7eb",
    background: "white",
    padding: "14px 16px",
    borderRadius: 14,
    cursor: "pointer",
    fontWeight: 700,
  },
  stationTabActive: {
    borderColor: "#2563eb",
    background: "#eff6ff",
  },
  badge: {
    background: "#111827",
    color: "white",
    borderRadius: 999,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 700,
  },
  queuePanel: {
    background: "white",
    borderRadius: 20,
    padding: 20,
    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
    minHeight: 500,
  },
  queueHeader: {
    marginBottom: 16,
  },
  muted: {
    color: "#6b7280",
    margin: "6px 0 0",
  },
  queueList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  queueItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 14,
    background: "#fafafa",
  },
  queueNumber: {
    width: 38,
    height: 38,
    minWidth: 38,
    borderRadius: 999,
    background: "#111827",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },
  queueActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 999,
  },
  modal: {
    width: "95vw",
    height: "90vh",
    background: "white",
    borderRadius: 20,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
  },
  modalHeader: {
    padding: 16,
    borderBottom: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  viewerControls: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  viewerArea: {
    flex: 1,
    background: "#e5e7eb",
    overflow: "auto",
    position: "relative",
  },
  imageWrap: {
    width: "100%",
    height: "100%",
    overflow: "auto",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: 24,
  },
  viewerImage: {
    maxWidth: "100%",
    height: "auto",
    transformOrigin: "top center",
    transition: "transform 0.15s ease",
    display: "block",
  },
  viewerIframe: {
    width: "100%",
    height: "100%",
    border: "none",
    background: "white",
  },
  unsupported: {
    padding: 30,
  },
  zoomLabel: {
    minWidth: 52,
    textAlign: "center",
    fontWeight: 700,
  },
  linkButton: {
    border: "1px solid #d1d5db",
    background: "white",
    color: "#111827",
    padding: "10px 14px",
    borderRadius: 12,
    textDecoration: "none",
    fontWeight: 600,
  },
};
