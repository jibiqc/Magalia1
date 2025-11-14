import React from "react";

export default function PriceGrid({ value, onChange }) {
  const v = value || {};
  const set = (k,val) => onChange({ ...v, [k]: val });

  const num = x => (x==="" || x===null || x===undefined) ? "" : Number(x);

  const onEur = (val) => {
    set("purchase_eur", val);
    const fx = Number(v.fx_eur_usd || 0);
    if (val !== "" && fx) set("purchase_usd", (Number(val)/fx).toFixed(2));
  };

  const onFx = (val) => {
    set("fx_eur_usd", val);
    const eur = Number(v.purchase_eur || 0);
    if (val !== "" && eur) set("purchase_usd", (eur/Number(val)).toFixed(2));
  };

  const onUsd = (val) => {
    set("purchase_usd", val);
    const eur = Number(v.purchase_eur || 0);
    if (val !== "" && eur) {
      const fx = eur / Number(val);
      if (isFinite(fx) && fx>0) set("fx_eur_usd", fx.toFixed(4));
    }
  };

  return (
    <div className="price-grid">
      <div className="pg-row">
        <label>Prix d'achat €</label>
        <input className="input" type="number" step="0.01"
          value={v.purchase_eur ?? ""} onChange={e=>onEur(e.target.value)} />
      </div>
      <div className="pg-row">
        <label>FX €→$</label>
        <input className="input" type="number" step="0.0001"
          value={v.fx_eur_usd ?? ""} onChange={e=>onFx(e.target.value)} />
      </div>
      <div className="pg-row">
        <label>Prix d'achat $</label>
        <input className="input" type="number" step="0.01"
          value={v.purchase_usd ?? ""} onChange={e=>onUsd(e.target.value)} />
      </div>
      <div className="pg-row">
        <label>Prix de vente $</label>
        <input className="input" type="number" step="0.01"
          value={v.sale_usd ?? ""} onChange={e=>set("sale_usd", e.target.value)} />
      </div>
    </div>
  );
}

