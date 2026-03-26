import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const STATIONS = ["p1", "p2", "p3", "p4"];

export default function App() {
  const [guides, setGuides] = useState({});
  const [selectedStation, setSelectedStation] = useState("p1");
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");

  // Cargar datos
  useEffect(() => {
    fetchGuides();

    const channel = supabase
      .channel("realtime-guides")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guides" },
        () => {
          fetchGuides();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  async function fetchGuides() {
    const { data } = await supabase.from("guides").select("*");

    const map = {};
    data?.forEach((g) => {
      map[g.station] = g;
    });

    setGuides(map);
  }

  async function handleUpload() {
    if (!file) return;

    const filePath = `${selectedStation}/${Date.now()}-${file.name}`;

    // Subir archivo
    const { error: uploadError } = await supabase.storage
      .from("guides")
      .upload(filePath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      alert("Error subiendo archivo");
      return;
    }

    const { data } = supabase.storage
      .from("guides")
      .getPublicUrl(filePath);

    const type = file.type === "application/pdf" ? "pdf" : "image";

    // Insert o update
    const { error } = await supabase.from("guides").upsert({
      station: selectedStation,
      title: title || file.name,
      notes,
      file_url: data.publicUrl,
      file_path: filePath,
      type,
      updated_at: new Date(),
    });

    if (error) {
      alert("Error guardando en base de datos");
    } else {
      setFile(null);
      setTitle("");
      setNotes("");
    }
  }

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>Bestamping · Control de Producción</h1>

      {/* Selector */}
      <select
        value={selectedStation}
        onChange={(e) => setSelectedStation(e.target.value)}
      >
        {STATIONS.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>

      {/* Subida */}
      <div style={{ marginTop: 20 }}>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
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
        <button onClick={handleUpload}>Subir</button>
      </div>

      {/* Visual */}
      <div style={{ marginTop: 40 }}>
        {STATIONS.map((s) => {
          const g = guides[s];
          return (
            <div key={s} style={{ marginBottom: 40 }}>
              <h2>{s}</h2>

              {g ? (
                <>
                  <p>{g.title}</p>
                  <p>{g.notes}</p>

                  {g.type === "image" ? (
                    <img src={g.file_url} width="300" />
                  ) : (
                    <iframe src={g.file_url} width="400" height="500" />
                  )}
                </>
              ) : (
                <p>Sin guía</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
