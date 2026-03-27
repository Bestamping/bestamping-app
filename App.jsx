import React, { useEffect, useState, useMemo } from "react";
import { supabase } from "./supabase";

const STATIONS = [
  { id: "p1", name: "Plancha 1" },
  { id: "p2", name: "Plancha 2" },
  { id: "p3", name: "Plancha 3" },
  { id: "p4", name: "Plancha 4" },
];

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const stationId = params.get("station") || "p1";

  if (view === "station") {
    return <StationScreen stationId={stationId} />;
  }

  return <AdminScreen />;
}

/* ================= ADMIN ================= */

function AdminScreen() {
  const [guides, setGuides] = useState([]);
  const [station, setStation] = useState("p1");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);

  useEffect(() => {
    load();

    const ch = supabase
      .channel("rt-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "guides" }, load)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, []);

  async function load() {
    const { data } = await supabase.from("guides").select("*");
    setGuides(data || []);
  }

  async function upload() {
    if (!file) return;

    const safeName = file.name.replace(/\s+/g, "_");
    const path = `uploads/${station}/${Date.now()}_${safeName}`;

    await supabase.storage.from("guides").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });

    const { data } = supabase.storage.from("guides").getPublicUrl(path);

    await supabase.from("guides").upsert({
      station,
      title: title || file.name,
      notes,
      file_url: data.publicUrl,
      file_path: path,
      type: file.type.includes("pdf") ? "pdf" : "image",
    });

    setFile(null);
    setTitle("");
    setNotes("");
    load();
  }

  async function remove(g) {
    await supabase.storage.from("guides").remove([g.file_path]);
    await supabase.from("guides").delete().eq("id", g.id);
    load();
  }

  const map = useMemo(() => {
    const m = {};
    STATIONS.forEach((s) => {
      m[s.id] = guides.find((g) => g.station === s.id);
    });
    return m;
  }, [guides]);

  return (
    <div style={adminWrap}>
      <h1>BeStamping Control</h1>

      <div style={card}>
        <select value={station} onChange={(e) => setStation(e.target.value)}>
          {STATIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <input
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          placeholder="Notas"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <input type="file" onChange={(e) => setFile(e.target.files[0])} />

        <button onClick={upload}>Subir</button>
      </div>

      <h2>Guías activas</h2>

      {STATIONS.map((s) => {
        const g = map[s.id];
        return (
          <div key={s.id} style={card}>
            <h3>{s.name}</h3>

            {g ? (
              <>
                <p>{g.title}</p>
                <button onClick={() => remove(g)}>Borrar</button>
              </>
            ) : (
              <p>Sin guía</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================= STATION ================= */

function StationScreen({ stationId }) {
  const [guide, setGuide] = useState(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    load();

    const ch = supabase
      .channel("rt-station")
      .on("postgres_changes", { event: "*", schema: "public", table: "guides" }, load)
      .subscribe();

    return () => supabase.removeChannel(ch);
  }, [stationId]);

  async function load() {
    const { data } = await supabase
      .from("guides")
      .select("*")
      .eq("station", stationId)
      .maybeSingle();

    setGuide(data);
    setScale(1);
  }

  function zoomIn() {
    setScale((s) => Math.min(s + 0.3, 5));
  }

  function zoomOut() {
    setScale((s) => Math.max(s - 0.3, 1));
  }

  if (!guide) return <div style={center}>Sin guía</div>;

  return (
    <div style={stationWrap}>
      <div style={header}>
        <div>{guide.title}</div>
        <div>{guide.notes}</div>
      </div>

      {guide.type === "image" ? (
        <div style={viewer}>
          <div style={controls}>
            <button onClick={zoomOut}>➖</button>
            <button onClick={zoomIn}>➕</button>
          </div>

          <div style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
            <img src={guide.file_url} style={{ maxWidth: "none" }} />
          </div>
        </div>
      ) : (
        <div style={viewer}>
          <a href={guide.file_url} target="_blank" style={pdfBtn}>
            📄 Abrir PDF
          </a>

          <iframe src={guide.file_url} style={{ width: "100%", height: "100%" }} />
        </div>
      )}
    </div>
  );
}

/* ================= STYLES ================= */

const adminWrap = {
  padding: 20,
  background: "#091224",
  color: "#fff",
  minHeight: "100vh",
};

const card = {
  background: "#111",
  padding: 15,
  marginBottom: 15,
  borderRadius: 10,
};

const stationWrap = {
  background: "#000",
  height: "100vh",
  color: "#fff",
};

const header = {
  position: "fixed",
  top: 0,
  width: "100%",
  padding: 10,
  background: "rgba(0,0,0,0.7)",
};

const viewer = {
  height: "100%",
  overflow: "auto",
  paddingTop: 60,
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
  top: 70,
  right: 10,
  background: "#fff",
  padding: 10,
  borderRadius: 10,
};

const center = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  height: "100vh",
};
