import React, { useState, useEffect } from "react";

const STORAGE_KEY = "bestamping-data";

function loadData() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data
    ? JSON.parse(data)
    : {
        orders: [],
      };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function App() {
  const [data, setData] = useState(loadData());

  useEffect(() => {
    saveData(data);
  }, [data]);

  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");

  // -------------------------
  // PANEL ADMIN
  // -------------------------
  if (view !== "station") {
    return (
      <div style={{ padding: 20, color: "white" }}>
        <h1>BeStamping Panel</h1>

        <button
          onClick={() =>
            setData({
              orders: [
                {
                  id: "001",
                  name: "Camiseta Roja",
                  temp: 150,
                  time: 12,
                  done: 0,
                  total: 10,
                },
              ],
            })
          }
        >
          Crear pedido demo
        </button>

        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  }

  // -------------------------
  // PANTALLA OPERARIO
  // -------------------------
  const order = data.orders[0];

  if (!order) {
    return (
      <div style={{ color: "white", padding: 20 }}>
        No hay pedidos
      </div>
    );
  }

  return (
    <div style={{ color: "white", padding: 20 }}>
      <h1>ASÍ SE HACE</h1>

      <h2>{order.name}</h2>

      <p>Temperatura: {order.temp}º</p>
      <p>Tiempo: {order.time}s</p>

      <h3>
        {order.done} / {order.total}
      </h3>

      <button
        onClick={() => {
          const updated = {
            ...data,
            orders: [
              {
                ...order,
                done: Math.min(order.done + 1, order.total),
              },
            ],
          };
          setData(updated);
        }}
      >
        Siguiente prenda
      </button>
    </div>
  );
}