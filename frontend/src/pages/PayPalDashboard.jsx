import { useEffect, useState } from "react";

export default function PayPalDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/connect/sources", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    })
      .then(res => res.json())
      .then(d => {
        const paypal = d.sources.find(s => s.source === "paypal");
        setData(paypal);
      });
  }, []);

  if (!data) return <div>Loading PayPal data...</div>;

  return (
    <div style={{ padding: "40px" }}>
      <h2>💰 PayPal Dashboard</h2>

      <div>Account: {data.account_name}</div>
      <div>Transactions: {data.transaction_count}</div>
      <div>Active Months: {data.date_range_months}</div>

      <hr />

      <p>✅ PayPal successfully connected!</p>
    </div>
  );
}