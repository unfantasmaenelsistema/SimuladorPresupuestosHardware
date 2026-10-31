import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { UseCaseId } from '../types/hardware';

interface QuizQuestion {
  id: number;
  category: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const SMR_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    category: 'Zócalos CPU',
    question:
      'En el taller intentas montar un procesador AMD Ryzen 5 7600X (Socket AM5) en una placa base MSI B550-A PRO (Socket AM4). ¿Qué ocurre física y técnicamente?',
    options: [
      'Encaja físicamente pero necesita actualizar la BIOS por USB Flashback.',
      'Es físicamente imposible: AM4 es un zócalo PGA (1331 pines en la CPU) y AM5 es LGA (1718 contactos en la placa base).',
      'Encaja si se retira el marco de retención SAM del socket.',
      'Funciona pero limitado a memoria DDR4 en Single Channel.',
    ],
    correctIndex: 1,
    explanation:
      'AM4 utiliza empaquetado PGA (los pines están en el procesador), mientras que AM5 dio el salto a LGA (los pines elásticos están en el zócalo de la placa base) y solo soporta controladores DDR5.',
  },
  {
    id: 2,
    category: 'Memoria RAM',
    question:
      'Tienes una placa base ATX con 4 ranuras DIMM (A1, A2, B1, B2) y un kit de 2 módulos de 16 GB (2x16 GB). ¿En qué ranuras debes instalarlos según el manual técnico para activar Dual Channel sin reflexiones de señal?',
    options: [
      'En A1 y A2 (las dos primeras ranuras más cercanas al socket CPU).',
      'En A2 y B2 (segunda y cuarta ranura contando desde el procesador).',
      'En A1 y B2 indistintamente, todas las combinaciones activan Quad Channel.',
      'En B1 y B2 (las dos ranuras más alejadas del procesador).',
    ],
    correctIndex: 1,
    explanation:
      'En topologías Daisy-Chain (prácticamente todas las placas DDR4 y DDR5 actuales), poblar primero A2 y B2 (slots 2 y 4) sitúa un módulo en el canal A y otro en el canal B al final de la pista eléctrica, evitando reflexiones de señal de alta frecuencia.',
  },
  {
    id: 3,
    category: 'Diagnóstico POST',
    question:
      'Montas un Intel Core i5-14600KF en una placa B760, conectas el cable HDMI al puerto integrado de la placa base y al encender el equipo no hay imagen y se ilumina el LED EZ-Debug "VGA". ¿Cuál es la causa?',
    options: [
      'La fuente de alimentación no tiene certificación 80 Plus Gold.',
      'Los procesadores Intel con sufijo "F" o "KF" carecen de gráficos integrados (iGPU), por lo que los puertos de vídeo de la placa base están inactivos.',
      'Falta activar el perfil XMP en la BIOS antes del primer encendido.',
      'El disco SSD NVMe no tiene instalado el controlador de vídeo.',
    ],
    correctIndex: 1,
    explanation:
      'El sufijo "F" en Intel (o los Ryzen sin sufijo G en serie 5000) indica ausencia de GPU integrada en el silicio. Es obligatorio instalar una tarjeta gráfica dedicada PCIe y conectar el monitor a las salidas de la tarjeta gráfica.',
  },
  {
    id: 4,
    category: 'Cableado Eléctrico PSU',
    question:
      '¿Qué sucede si un alumno fuerza un conector de alimentación PCIe de 6+2 pines (destinado a tarjetas gráficas) dentro del zócalo EPS 12V de 8 pines de alimentación de la CPU en la placa base?',
    options: [
      'Funciona con normalidad porque ambos entregan +12V en los mismos pines.',
      'Provoca un cortocircuito directo (+12V contra Masa/GND) porque la polaridad de las filas superior e inferior está invertida entre EPS y PCIe.',
      'Entrega solo +5V al procesador reduciendo su frecuencia a la mitad.',
      'Activa automáticamente el modo PCIe 5.0 en el procesador.',
    ],
    correctIndex: 1,
    explanation:
      'En el conector EPS 12V (4+4 pines), toda la fila del clip tiene +12V (amarillos), mientras que en el conector PCIe (6+2 pines) esa misma fila son cables de Tierra/GND (negros). Forzarlo provoca un cortocircuito inmediato que dispara la protección SCP de la fuente o quema la placa.',
  },
  {
    id: 5,
    category: 'Panel Frontal F_PANEL',
    question:
      'Tras terminar el montaje, el ordenador enciende perfectamente al pulsar el botón de la caja, pero el piloto luminoso de encendido (POWER LED) nunca se ilumina. ¿Cuál es la avería más probable?',
    options: [
      'El pulsador POWER_SW se ha conectado con la polaridad invertida.',
      'Los conectores POWER_LED+ y POWER_LED- están conectados con la polaridad invertida en los pines 2 y 4 del cabezal JFP1/F_PANEL.',
      'La pila CR2032 de la CMOS está agotada.',
      'Falta conectar el cable de audio frontal HD_AUDIO.',
    ],
    correctIndex: 1,
    explanation:
      'Los interruptores momentáneos (POWER_SW y RESET_SW) no tienen polaridad (solo cierran contacto), pero los diodos emisores de luz (POWER_LED y HDD_LED) solo conducen corriente cuando el ánodo (+) se conecta al pin positivo y el cátodo (-) al negativo.',
  },
  {
    id: 6,
    category: 'Geometría y Montaje',
    question:
      'Al cambiar una placa base Micro-ATX por una ATX en un chasis compatible, ¿qué precaución mecánica es crítica respecto a los separadores metálicos (standoffs) del chasis?',
    options: [
      'Retirar todos los separadores para atornillar el PCB directamente contra la chapa de la caja.',
      'Verificar que cada separador coincida exactamente con un agujero metalizado de la nueva placa; un separador sobrante debajo del PCB hará cortocircuito con las soldaduras traseras.',
      'Poner pasta térmica en la rosca de los separadores.',
      'Usar únicamente 2 tornillos en la esquina superior para dejar flotante la placa.',
    ],
    correctIndex: 1,
    explanation:
      'Dejar un poste separador metálico (standoff) en una posición donde la nueva placa no tiene orificio de anclaje hace que el metal toque las pistas o soldaduras traseras del PCB, provocando cortocircuitos al encender.',
  },
  {
    id: 7,
    category: 'Refrigeración y TDP',
    question:
      'Al instalar un disipador nuevo, el procesador alcanza 100 °C en pocos segundos tras entrar en la BIOS y el aire que sale del disipador está completamente frío. ¿Qué error de montaje se ha cometido?',
    options: [
      'La memoria RAM no tiene disipador pasivo de aluminio.',
      'No se ha retirado el plástico protector adhesivo de la base de cobre del disipador o no se ha aplicado pasta térmica / apretado el anclaje en cruz.',
      'La fuente de alimentación es demasiado potente para el equipo.',
      'El disco duro es SATA en lugar de NVMe.',
    ],
    correctIndex: 1,
    explanation:
      'Si el bloque del disipador está frío mientras el núcleo de la CPU hierve a 100 °C, no existe transferencia térmica entre el IHS de la CPU y la base del disipador (olvido de la pegatina transparente "Warning: Remove before installation" o falta de presión de contacto).',
  },
  {
    id: 8,
    category: 'Memoria DDR4 vs DDR5',
    question:
      '¿Cuál de las siguientes diferencias técnicas entre un módulo DIMM DDR4 y un módulo DIMM DDR5 de escritorio es cierta?',
    options: [
      'DDR4 tiene 240 pines y DDR5 tiene 288 pines.',
      'Ambos tienen 288 contactos, pero la muesca física está en distinta posición y en DDR5 el regulador de voltaje (PMIC a 1.1V) va integrado en el propio módulo RAM.',
      'Los módulos DDR4 pueden instalarse en placas DDR5 activando el modo CSM en BIOS.',
      'DDR5 solo funciona en Single Channel.',
    ],
    correctIndex: 1,
    explanation:
      'Tanto DDR4 como DDR5 utilizan 288 pines en formato UDIMM, pero la muesca guía está desplazada para evitar inserciones cruzadas. Además, DDR5 opera a 1.1V e incorpora el chip PMIC (Power Management IC) en el propio módulo.',
  },
];

// Orden aleatorio de las opciones de cada pregunta (Fisher-Yates), para que la
// respuesta correcta no esté siempre en la misma posición.
function shuffledOptionOrders(): Record<number, number[]> {
  const orders: Record<number, number[]> = {};
  for (const q of SMR_QUIZ_QUESTIONS) {
    const idx = q.options.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    orders[q.id] = idx;
  }
  return orders;
}

export const InteractiveQuizAndGenerator: React.FC<{
  onApplyGeneratedOrder: (useCaseId: UseCaseId, budget: number, description: string) => void;
}> = ({ onApplyGeneratedOrder }) => {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [optionOrders, setOptionOrders] = useState(shuffledOptionOrders);
  const [generatedOrderText, setGeneratedOrderText] = useState<string | null>(null);

  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = SMR_QUIZ_QUESTIONS.filter(
    (q) => selectedAnswers[q.id] === q.correctIndex
  ).length;

  const handleGenerateRandomClientOrder = () => {
    const orders: {
      useCaseId: UseCaseId;
      budget: number;
      text: string;
    }[] = [
      {
        useCaseId: 'ofimatica',
        budget: 475,
        text: 'Encargo #104 — Clínica Dental: Necesitan un equipo silencioso de recepción por máximo 475 € con gráficos integrados, 16 GB RAM en Dual Channel, SSD de al menos 480 GB y consumo pico ≤ 250 W.',
      },
      {
        useCaseId: 'gaming',
        budget: 1325,
        text: 'Encargo #208 — Cliente Gaming Competitivo 1440p: Presupuesto cerrado de 1.325 €. Exige gráfica dedicada de al menos 12 GB VRAM, 32 GB RAM en Dual Channel, NVMe ≥ 1 TB y fuente 80 Plus con margen ≥ 20%.',
      },
      {
        useCaseId: 'virtualizacion',
        budget: 1850,
        text: 'Encargo #312 — Aula de Redes y Sistemas (Servidor Proxmox): Presupuesto de 1.850 €. Requiere mínimo 12 núcleos / 24 hilos, 64 GB RAM, SSD NVMe ≥ 1 TB para VMs y una unidad secundaria para copias.',
      },
      {
        useCaseId: 'edicion',
        budget: 1650,
        text: 'Encargo #419 — Productora de Vídeo Freelance: Presupuesto máximo de 1.650 €. Necesita procesador de ≥ 8 núcleos, GPU NVIDIA o AMD con ≥ 12 GB VRAM, 32 GB RAM en Dual Channel y NVMe ≥ 1 TB.',
      },
    ];

    const randomPick = orders[Math.floor(Math.random() * orders.length)];
    setGeneratedOrderText(randomPick.text);
    onApplyGeneratedOrder(randomPick.useCaseId, randomPick.budget, randomPick.text);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Autoevaluación Teórico-Práctica y Generador de Supuestos de Taller
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Test Oficial de Montaje y Diagnóstico SMR ({correctCount}/{SMR_QUIZ_QUESTIONS.length} aciertos)
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleGenerateRandomClientOrder}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generar Nuevo Encargo de Cliente Aleatorio
          </button>

          {answeredCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedAnswers({});
                setOptionOrders(shuffledOptionOrders());
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reiniciar Test
            </button>
          )}
        </div>
      </div>

      {generatedOrderText && (
        <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-300 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200 flex items-start justify-between gap-3">
          <div>
            <div className="font-bold mb-0.5">
              Nuevo Supuesto Práctico Cargado en el Simulador:
            </div>
            <p>{generatedOrderText}</p>
          </div>
          <button
            type="button"
            onClick={() => setGeneratedOrderText(null)}
            className="text-sky-600 dark:text-sky-400 hover:underline shrink-0 cursor-pointer"
          >
            Cerrar aviso
          </button>
        </div>
      )}

      {/* Quiz Questions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SMR_QUIZ_QUESTIONS.map((q) => {
          const userAnswer = selectedAnswers[q.id];
          const isAnswered = userAnswer !== undefined;
          const isCorrect = userAnswer === q.correctIndex;

          return (
            <div
              key={q.id}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                  <span>
                    Pregunta #{q.id} · {q.category}
                  </span>
                  {isAnswered && (
                    <span
                      className={
                        isCorrect
                          ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                          : 'text-rose-600 dark:text-rose-400 font-bold'
                      }
                    >
                      {isCorrect ? '✓ CORRECTA' : '✕ INCORRECTA'}
                    </span>
                  )}
                </div>

                <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-relaxed">
                  {q.question}
                </h3>

                <div className="space-y-1.5 pt-1">
                  {optionOrders[q.id].map((idx) => {
                    const opt = q.options[idx];
                    const isThisSelected = userAnswer === idx;
                    const isThisCorrect = idx === q.correctIndex;

                    let btnStyle =
                      'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-sky-500';
                    if (isAnswered) {
                      if (isThisCorrect) {
                        btnStyle =
                          'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-medium';
                      } else if (isThisSelected && !isThisCorrect) {
                        btnStyle =
                          'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-900 dark:text-rose-200';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={isAnswered}
                        aria-pressed={isThisSelected}
                        onClick={() =>
                          setSelectedAnswers((prev) =>
                            prev[q.id] === undefined ? { ...prev, [q.id]: idx } : prev
                          )
                        }
                        className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${isAnswered ? 'cursor-default' : 'cursor-pointer'} ${btnStyle}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isAnswered && (
                <div
                  className={`p-3 rounded-lg border text-xs leading-relaxed ${
                    isCorrect
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/70 text-slate-700 dark:text-slate-300'
                      : 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800/70 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <strong className="text-slate-900 dark:text-slate-100">
                    Justificación de taller:{' '}
                  </strong>
                  {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
