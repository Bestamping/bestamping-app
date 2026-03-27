import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";

function App() {
  const [file, setFile] = useState(null);
  const [guides, setGuides] = useState([]);

  useEffect(() => {
    fetchGuides();
  }, []);

  const fetchGuides = async () => {
    const { data, error } = await supabase
      .from("guides")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setGuides(data);
  };

  const handleUpload = async () => {
    if (!file) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = fileName;

    // subir archivo
    const { error: uploadError } = await supabase.storage
      .from("guides")
.upload(filePath, file, {
  upsert: true,
  contentType: file.type,
});
    if (uploadError) {
      alert("Error subiendo archivo");
      return;
    }

    // obtener URL pública
    const { data } = supabase.storage
      .from("guides")
      .getPublicUrl(filePath);

    const fileUrl = data.publicUrl;

    // guardar en DB
    await supabase.from("guides").insert([
      {
        station: "default",
        title: file.name,
        file_url: fileUrl,
        file_path: filePath,
        type: file.type.includes("pdf") ? "pdf" : "image",
      },
    ]);

    setFile(null);
    fetchGuides();
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>BeStamping Guides</h1>

      <input
        type="file"
        accept="image/*,.pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <button onClick={handleUpload} style={{ marginLeft: 10 }}>
        Subir
      </button>

      <hr />

      {guides.map((g) => (
        <div key={g.id} style={{ marginBottom: 30 }}>
          <h3>{g.title}</h3>

          {g.type === "image" ? (
            <img
              src={g.file_url}
              alt=""
              style={{ width: "100%", maxWidth: 400 }}
            />
          ) : (
            <iframe
              src={g.file_url}
              title="pdf"
              width="100%"
              height="500px"
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default App;
