const API_BASE = "http://localhost:8000"; // configurar base do gateway (ex: https://api.seudominio.com)

const form = document.getElementById("quoteForm");
const submitBtn = document.getElementById("submitBtn");
const statusEl = document.getElementById("status");

const result = document.getElementById("result");
const leadIdEl = document.getElementById("leadId");
const slaEl = document.getElementById("sla");
const slaHintEl = document.getElementById("slaHint");
const newBtn = document.getElementById("newBtn");

function computeSLA({ urgency, equipment_type }) {
  // Simples e honesto. Quem define “verdadeiro” SLA é operação + IA no n8n.
  const base = {
    normal: "até 24h úteis",
    alta: "até 8h úteis",
    critica: "até 2h úteis",
  }[urgency || "normal"];

  // Ajuste leve por tipo
  const heavy = ["Placa eletrônica", "Automação", "Outro", "Inversor"];
  const isHeavy = heavy.includes(equipment_type);

  if (urgency === "critica") return base;
  if (isHeavy && urgency === "normal") return "até 48h úteis";
  return base;
}

function setBusy(isBusy, msg = "") {
  submitBtn.disabled = isBusy;
  submitBtn.textContent = isBusy ? "Enviando..." : "Enviar Solicitação";
  statusEl.textContent = msg;
  statusEl.style.color = isBusy ? "#94a39e" : "#ff6b6b";
  if (msg.includes("sucesso") || msg.includes("Registrando")) {
    statusEl.style.color = "#4ade80";
  }
}

function getFormData(formEl) {
  const fd = new FormData(formEl);
  return {
    name: (fd.get("name") || "").trim(),
    email: (fd.get("email") || "").trim(),
    phone: (fd.get("phone") || "").trim(),
    company: (fd.get("company") || "").trim(),
    city: (fd.get("city") || "").trim(),
    equipment_type: fd.get("equipment_type") || "",
    description: (fd.get("description") || "").trim(),
    attachments: [],
    urgency: fd.get("urgency") || "normal",
  };
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = getFormData(form);

  // validação mínima client-side (sem confiar nela)
  if (
    !data.name ||
    !data.email ||
    !data.phone ||
    !data.city ||
    !data.equipment_type ||
    !data.description
  ) {
    setBusy(false, "Preencha os campos obrigatórios (*)");
    return;
  }

  setBusy(true, "Registrando protocolo...");

  try {
    const res = await fetch(`${API_BASE}/api/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Tratamento amigável de erro 422 (Validação FastAPI/Pydantic)
      if (res.status === 422 && Array.isArray(body.detail)) {
        const errors = body.detail.map(err => {
          const field = err.loc[err.loc.length - 1]; // Pega o nome do campo
          return `${field}: ${err.msg}`;
        }).join(" | ");
        throw new Error(`Dados inválidos: ${errors}`);
      }

      const msg = body?.message || body?.detail || "Erro ao conectar com servidor.";
      throw new Error(typeof msg === 'object' ? JSON.stringify(msg) : msg);
    }

    // seu backend deve retornar lead_id; se não retornar, dá pra pegar do n8n, mas o ideal é o gateway responder
    const leadId = body.lead_id || body.leadId || body?.data?.lead_id;
    if (!leadId)
      console.warn("API não retornou lead_id explícito. Exibindo provisório.");

    const sla = computeSLA(data);

    leadIdEl.textContent = leadId || `REQ-${Math.floor(Math.random() * 10000)}`;
    slaEl.textContent = sla;
    slaHintEl.textContent =
      data.urgency === "critica" ? " (Prioridade Máxima Atribuída)" : "";

    result.classList.remove("hidden");
    form.closest(".form-wrapper").classList.add("hidden");
    setBusy(false, "");
  } catch (err) {
    console.error(err);
    setBusy(false, err.message || "Falha ao registrar. Tente novamente.");
  }
});

newBtn.addEventListener("click", () => {
  result.classList.add("hidden");
  form.closest(".form-wrapper").classList.remove("hidden");
  form.reset();
  statusEl.textContent = "";
});
