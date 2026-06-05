"use client";

import { useEffect, useRef, useState } from "react";
import { useDiaryStore } from "@/components/proprietario/diario/useDiaryStore";
import { createClient, supabase } from "src/lib/supabase/supabase";

import { DashboardStats } from "./DashboardStats";
import { SearchBar } from "./SearchBar";




export function DiaryPage() {
  const fetchNotes = useDiaryStore((s) => s.fetchNotes);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectingMonth, setSelectingMonth] = useState(false);
  const [selectingYear, setSelectingYear] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [results, setResults] = useState<any[]>([]);


  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchNotes();
    fetchEvents();
  }, []);

  useEffect(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowModal(false);
      setShowCalendar(false); // já fecha os dois 🔥
    }
  };

  window.addEventListener("keydown", handleEsc);

  return () => {
    window.removeEventListener("keydown", handleEsc);
  };
}, []);

useEffect(() => {
  if (showModal || showCalendar) {
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "auto";
  }

  return () => {
    document.body.style.overflow = "auto";
  };
}, [showModal, showCalendar]);



  const fetchEvents = async () => {
    const { data, error } = await supabase.from("diary_events").select("*");

    if (error) {
      console.error(error);
      return;
    }

    setEvents(data || []);
  };

  const openDatePicker = () => {
    dateInputRef.current?.showPicker?.();
  };

  const changeDay = (dir: number) => {
    setCurrentDate((prev) => new Date(prev.getTime() + dir * 86400000));
  };

  const goToToday = () => setCurrentDate(new Date());

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const openNew = (hour?: number) => {
    setSelectedEvent({
      hour,
      date: currentDate,
      subject: "",
      tags: "",
      context: "trabalho",
    });
    setShowModal(true);
  };

const saveEvent = async () => {
  if (!selectedEvent.subject) return;

  let fileUrl = selectedEvent.file_url || null;

  // ✅ SE EXISTE NOVO ARQUIVO → SUBSTITUI
  if (selectedEvent.file) {
    const file = selectedEvent.file;

    const fileName = `${Date.now()}-${file.name}`;

    // 🗑 REMOVE ARQUIVO ANTIGO (se existir)
    if (selectedEvent.file_url) {
      try {
        const oldPath = selectedEvent.file_url.split("/storage/v1/object/public/diary-files/")[1];

        if (oldPath) {
          await supabase.storage
            .from("diary-files")
            .remove([oldPath]);
        }
      } catch (err) {
        console.warn("Erro ao remover arquivo antigo", err);
      }
    }

    // ⬆️ UPLOAD NOVO
    const { error: uploadError } = await supabase.storage
      .from("diary-files")
      .upload(fileName, file);

    if (uploadError) {
      console.error(uploadError);
      alert("Erro ao fazer upload do arquivo");
      return;
    }

    const { data } = supabase.storage
      .from("diary-files")
      .getPublicUrl(fileName);

    fileUrl = data.publicUrl;
  }

  // ✅ SE FOR EDIÇÃO → UPDATE
  if (selectedEvent.id) {
    const { error } = await supabase
      .from("diary_events")
      .update({
        date: selectedEvent.date,
        hour: selectedEvent.hour,
        subject: selectedEvent.subject,
        tags: selectedEvent.tags,
        context: selectedEvent.context,
        status: selectedEvent.status,
        repeat_days: selectedEvent.repeat,
        address: selectedEvent.address,
        file_url: fileUrl,
      })
      .eq("id", selectedEvent.id);

    if (error) {
      console.error(error);
      alert("Erro ao atualizar");
      return;
    }
  } else {
    // ✅ NOVO EVENTO
    const { error } = await supabase.from("diary_events").insert([
      {
        date: new Date(
  selectedEvent.date.getFullYear(),
  selectedEvent.date.getMonth(),
  selectedEvent.date.getDate()
),
        hour: selectedEvent.hour,
        subject: selectedEvent.subject,
        tags: selectedEvent.tags,
        context: selectedEvent.context,
        status: selectedEvent.status,
        repeat_days: selectedEvent.repeat,
        address: selectedEvent.address,
        file_url: fileUrl,
      },
    ]);

    if (error) {
      console.error(error);
      alert("Erro ao salvar");
      return;
    }
  }

  await fetchEvents();
  setShowModal(false);
};



  // ✅ remover upload


const removeFile = async () => {
  if (!selectedEvent.file_url) return;

  try {
    const path = selectedEvent.file_url.split("/storage/v1/object/public/diary-files/")[1];

    if (path) {
      await supabase.storage
        .from("diary-files")
        .remove([path]);
    }

    // limpa no estado
    setSelectedEvent({
      ...selectedEvent,
      file_url: null,
      file: null,
    });

  } catch (err) {
    console.error("Erro ao remover arquivo", err);
    alert("Erro ao remover arquivo");
  }
};

  const deleteEvent = async () => {
    if (!selectedEvent.id) return;

    await supabase.from("diary_events").delete().eq("id", selectedEvent.id);

    await fetchEvents();
    setShowModal(false);
  };

  const handleDownload = async () => {
    if (!selectedEvent.file_url) return;

    const response = await fetch(selectedEvent.file_url);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = selectedEvent.file_url.split("/").pop() || "arquivo";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const nextDate = new Date(currentDate);
nextDate.setDate(currentDate.getDate() + 1);

  return (
    <div className="min-h-screen p-6">

      <h1 className="text-3xl font-semibold mb-6">📒 Diário Inteligente</h1>

      <DashboardStats />

      <div className="flex flex-wrap justify-center gap-3 mt-4">
        <button onClick={() => setShowCalendar(true)} className="bg-white px-4 py-2 rounded-xl shadow">
          📅 Data
        </button>

        <button onClick={goToToday} className="bg-yellow-500 text-white px-4 py-2 rounded-xl shadow">
          Hoje
        </button>

        <button onClick={() => openNew()} className="bg-green-600 text-white px-4 py-2 rounded-xl shadow">
          + Adicionar
        </button>

        <div className="w-72 flex gap-2">
  <input
    value={searchInput}
    onChange={(e) => setSearchInput(e.target.value)}
   onKeyDown={(e) => {
  if (e.key === "Enter") {
    const term = searchInput.toLowerCase();



    
    const filtered = events.filter((e: any) => {
      return (
        e.subject?.toLowerCase().includes(term) ||
        e.tags?.toLowerCase().includes(term) ||
        e.context?.toLowerCase().includes(term) ||
        e.address?.toLowerCase().includes(term)
      );
    });

    setSearch(searchInput);
    setResults(filtered);
    setShowSearchResults(true);
  }
}}
    placeholder="Buscar por texto, nome, empresa..."
    className="w-full border p-2 rounded-lg bg-white shadow-sm"
  />
  <button
    onClick={() => {
      setSearch(searchInput);
      const term = searchInput.toLowerCase();
      const filtered = events.filter((e: any) => {
        return (
          e.subject?.toLowerCase().includes(term) ||
          e.tags?.toLowerCase().includes(term) ||
          e.context?.toLowerCase().includes(term) ||
          e.address?.toLowerCase().includes(term)
        );
      });
      setResults(filtered);
      setShowSearchResults(true);
    }}
    className="bg-blue-600 text-white px-4 rounded-lg hover:scale-105 transition"
  >
    🔍
  </button>
</div>
</div>

      {/* FILTRAGEM DE EVENTOS */}
      {(() => {
        const term = search.toLowerCase();
        const filteredEvents = events.filter((e: any) => {
          if (!search) return true;
          return (
            e.subject?.toLowerCase().includes(term) ||
            e.tags?.toLowerCase().includes(term) ||
            e.context?.toLowerCase().includes(term) ||
            e.address?.toLowerCase().includes(term)
          );
        });

        return (
      <div className="flex justify-center mt-10 relative">

        <button
          onClick={() => changeDay(-1)}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-white w-12 h-12 rounded-full shadow"
        >
          ←
        </button>

        <button
          onClick={() => changeDay(1)}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-white w-12 h-12 rounded-full shadow"
        >
          →
        </button>

        <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl flex overflow-hidden">

          <Page
            date={currentDate}
            hours={hours}
            events={filteredEvents}
            onClickHour={openNew}
            onClickEvent={(e: any) => {
              setSelectedEvent(e);
              setShowModal(true);
            }}
          />

          <Page
            date={nextDate}
            hours={hours}
            events={filteredEvents}
            onClickHour={openNew}
            onClickEvent={(e: any) => {
              setSelectedEvent(e);
              setShowModal(true);
            }}
          />
        </div>
      </div>
        );
      })()}





{showCalendar && (
  <div
  onClick={() => setShowCalendar(false)}
  className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
>
    <div
  onClick={(e) => e.stopPropagation()}
  className="bg-white rounded-2xl shadow-2xl p-6 w-[320px]"
>

      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() =>
            setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))
          }
        >
          ←
        </button>

        <h2 className="font-semibold cursor-pointer hover:text-yellow-600" onClick={() => setSelectingMonth(!selectingMonth)}>
          {currentDate.toLocaleDateString("pt-BR", {
            month: "long",
          })} 
          <span className="ml-1 hover:text-yellow-600" onClick={(e) => { e.stopPropagation(); setSelectingYear(!selectingYear); }}>
            {currentDate.getFullYear()}
          </span>
        </h2>

        <button
          onClick={() =>
            setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))
          }
        >
          →
        </button>
      </div>

      {/* DIAS DA SEMANA */}
<div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-2">
  {["D","S","T","Q","Q","S","S"].map((d) => (
    <div key={d}>{d}</div>
  ))}
</div>

font-semibold

{/* SELETOR DE MÊS */}
{selectingMonth && (
  <div className="grid grid-cols-3 gap-2 mb-4">
    {["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"].map((m, i) => (
      <button
        key={i}
        onClick={() => {
          const newDate = new Date(currentDate);
          newDate.setMonth(i);
          setCurrentDate(newDate);
          setSelectingMonth(false);
        }}
        className="p-2 rounded-lg hover:bg-yellow-400 hover:text-white"
      >
        {m}
      </button>
    ))}
  </div>
)}

{/* SELETOR DE ANO */}
{selectingYear && (
  <div className="grid grid-cols-4 gap-2 mb-4 max-h-40 overflow-y-auto">
    {Array.from({ length: 20 }, (_, i) => {
      const year = new Date().getFullYear() - 10 + i;

      return (
        <button
          key={year}
          onClick={() => {
            const newDate = new Date(currentDate);
            newDate.setFullYear(year);
            setCurrentDate(newDate);
            setSelectingYear(false);
          }}
          className="p-2 rounded-lg hover:bg-yellow-400 hover:text-white"
        >
          {year}
        </button>
      );
    })}
  </div>
)}

{/* DIAS */}
{!selectingMonth && !selectingYear && (
  <div className="grid grid-cols-7 gap-2 text-center">
    {Array.from(
      {
        length: new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0
        ).getDate(),
      },
      (_, i) => {
        const day = i + 1;

        const date = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          day
        );

        return (
          <button
            key={day}
            onClick={() => {
              setCurrentDate(date);
              setShowCalendar(false);
            }}
                  >
            {day}
          </button>
        );
      }
    )}
  </div>
)}

    </div>
  </div>
)}



      {/* MODAL */}
    {showModal && (
  <div
  onClick={() => setShowModal(false)}
  className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
>
    <div
  onClick={(e) => e.stopPropagation()}
  className="bg-white w-full max-w-xl rounded-2xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
>



      {/* HEADER */}

      <h2 className="text-xl font-semibold flex items-center gap-2">
        📌 Evento
      </h2>

      {/* DATA + HORA */}
      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          value={new Date(selectedEvent.date).toISOString().split("T")[0]}
          onChange={(e) =>
            {
              const [year, month, day] = e.target.value.split("-");
              setSelectedEvent({
                ...selectedEvent,
                date: new Date(Number(year), Number(month) - 1, Number(day)),
              });
            }
          }
          className="border p-2 rounded-lg"
        />
      </div>

        <select
  value={selectedEvent.hour ?? ""}
  onChange={(e) =>
    setSelectedEvent({ ...selectedEvent, hour: Number(e.target.value) })
  }
  className="border p-2 rounded-lg"
>
  <option value="">Selecionar hora</option>

  {Array.from({ length: 24 }, (_, i) => (
    <option key={i} value={i}>
      {i.toString().padStart(2, "0")}:00
    </option>
  ))}
</select>

      {/* ASSUNTO */}
      <input
        placeholder="Assunto"
        value={selectedEvent.subject}
        onChange={(e) =>
          setSelectedEvent({ ...selectedEvent, subject: e.target.value })
        }
        className="w-full border p-2 rounded-lg"
      />

      {/* CONTEXTO */}
      <select
        value={selectedEvent.context}
        onChange={(e) =>
          setSelectedEvent({ ...selectedEvent, context: e.target.value })
        }
        className="w-full border p-2 rounded-lg"
      >
        <option value="trabalho">💼 Trabalho</option>
        <option value="pessoal">🏠 Pessoal</option>
        <option value="academia">🏋️ Academia</option>
        <option value="eventos">🎉 Eventos</option>
      </select>

      {/* TAGS */}
      <input
        placeholder="Tags (ex: cliente, obra, reunião)"
        value={selectedEvent.tags || ""}
        onChange={(e) =>
          setSelectedEvent({ ...selectedEvent, tags: e.target.value })
        }
        className="w-full border p-2 rounded-lg"
      />

      {/* STATUS */}
      <select
        value={selectedEvent.status || "pendente"}
        onChange={(e) =>
          setSelectedEvent({ ...selectedEvent, status: e.target.value })
        }
        className="w-full border p-2 rounded-lg"
      >
        <option value="pendente">🕒 Pendente</option>
        <option value="concluido">✅ Concluído</option>
        <option value="cancelado">❌ Cancelado</option>
      </select>

      {/* RECORRENTE */}
      <div>
        <p className="text-sm font-medium mb-1">Repetir</p>
        <div className="flex gap-2 flex-wrap">
          {["Dom","Seg","Ter","Qua","Qui","Sex","Sab"].map((d) => {
            const active = selectedEvent.repeat?.includes(d);

            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  const days = selectedEvent.repeat || [];
                  const updated = active
                    ? days.filter((x: string) => x !== d)
                    : [...days, d];

                  setSelectedEvent({ ...selectedEvent, repeat: updated });
                }}
                className={`px-2 py-1 rounded-md text-xs border transition ${
                  active
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 hover:bg-gray-200"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* ENDEREÇO */}
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selectedEvent.hasAddress || false}
            onChange={(e) =>
              setSelectedEvent({ ...selectedEvent, hasAddress: e.target.checked })
            }
          />
          📍 Adicionar endereço
        </label>

        {selectedEvent.hasAddress && (
          <input
            placeholder="Endereço"
            value={selectedEvent.address || ""}
            onChange={(e) =>
              setSelectedEvent({ ...selectedEvent, address: e.target.value })
            }
            className="w-full border p-2 rounded-lg mt-2"
          />
        )}
      </div>

      {/* ANEXO */}
            <div>
              <p className="text-sm mb-1">📎 Anexo</p>

              {/* UPLOAD */}
              <input
                type="file"
                onChange={(e) =>
                  setSelectedEvent({
                    ...selectedEvent,
                    file: e.target.files?.[0],
                  })
                }
              />

            {/* EXIBIÇÃO DO ARQUIVO SALVO */}
{selectedEvent.file_url && (
  <div className="mt-3 space-y-2 border rounded-lg p-2 bg-gray-50">
                  {selectedEvent.file_url.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                    <div className="space-y-2">
                      <img
                        src={selectedEvent.file_url}
                        alt="Anexo"
                        className="w-full max-h-40 object-contain rounded-lg border"
                      />

                      <div className="flex gap-3">
                        <button onClick={handleDownload} className="text-blue-600 text-xs underline">
                          📥 Baixar
                        </button>

                        <button onClick={removeFile} className="text-red-500 text-xs underline">
                          🗑 Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={handleDownload} className="text-blue-600 underline text-sm">
                        📥 Baixar arquivo
                      </button>

                      <button onClick={removeFile} className="text-red-500 text-sm underline">
                        🗑 Remover
                      </button>
                    </div>
                  )}
  </div>
)}
            </div>





      {/* BOTÕES */}
      <div className="flex justify-between pt-2">
        <button
          onClick={saveEvent}
          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:scale-105 transition"
        >
          Salvar
        </button>

        <button
          onClick={deleteEvent}
          className="bg-red-500 text-white px-4 py-2 rounded-lg shadow hover:scale-105 transition"
        >
          Excluir
        </button>

        <button
          onClick={() => setShowModal(false)}
          className="bg-gray-200 px-4 py-2 rounded-lg hover:scale-105 transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>  
)}

{showSearchResults && (
  <div
    onClick={() => setShowSearchResults(false)}
    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl p-6 max-h-[80vh] overflow-y-auto"
    >
      <h2 className="text-xl font-semibold mb-4">
        🔍 Resultados da busca
      </h2>

      {results.length === 0 && (
        <p className="text-gray-500 text-sm">
          Nenhum resultado encontrado
        </p>
      )}

      <div className="space-y-2">
        {results.map((e: any) => {
          const date = new Date(e.date);

          return (
            <div
              key={e.id}
              onClick={() => {
                setCurrentDate(date);
                setSelectedEvent(e);
                setShowSearchResults(false);
                setShowModal(true);
              }}
              className="p-3 border rounded-lg hover:bg-gray-100 cursor-pointer"
            >
              <p className="font-medium">{e.subject}</p>

              <p className="text-xs text-gray-500">
                📅 {date.toLocaleDateString("pt-BR")} às {e.hour}:00
              </p>

              {e.tags && (
                <p className="text-xs text-blue-500">
                  🏷 {e.tags}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </div>
)}
</div>
  );
}

/* PAGE */
function Page({ date, hours, events, onClickHour, onClickEvent }: any) {
  function setSelectingMonth(arg0: boolean): void {
  throw new Error("Function not implemented.");
}

function setSelectingYear(arg0: boolean): void {
  throw new Error("Function not implemented.");
}

  return (
    <div className="w-1/2 p-6 border-r">

      <div className="text-center mb-6">
        <p className="text-[17px]  text-gray-500">
          {date.toLocaleDateString("pt-BR", { weekday: "long" })}
        </p>
        <p className="font-semibold">
  {date.toLocaleDateString("pt-BR")}
</p>
        <div className="space-y-2">
          {hours.map((h: number) => {
            const event = events.find((e: any) => {
              if (e.hour !== h) return false;
              const eventDate = new Date(e.date);
              const localEventDate = new Date(
                eventDate.getUTCFullYear(),
                eventDate.getUTCMonth(),
                eventDate.getUTCDate()
              );
              const localPageDate = new Date(
                date.getFullYear(),
                date.getMonth(),
                date.getDate()
              );
              return localEventDate.getTime() === localPageDate.getTime();
            });

            return (
              <div
                key={h}
                onClick={() => (event ? onClickEvent(event) : onClickHour(h))}
                className={`p-2 border-b cursor-pointer hover:bg-gray-50 flex justify-between items-center min-h-[40px] ${
                  event ? "bg-yellow-50 border-l-4 border-l-yellow-400" : ""
                }`}
              >
                <span className="text-xs text-gray-400 w-10">
                  {h.toString().padStart(2, "0")}:00
                </span>
                <span className="flex-1 text-sm truncate ml-2">
                  {event?.subject || ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
