import React from 'react';
import {
  BookOpen,
  Cpu,
  HardDrive,
  Layers,
  MemoryStick,
  Ruler,
  Terminal,
  Zap,
} from 'lucide-react';

export const WorkshopReferenceGuide: React.FC = () => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Manual Didáctico de Taller — Montaje y Reparación de Sistemas Microinformáticos
        </div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          Guía Técnica de Compatibilidad Física, Eléctrica y Diagnóstico POST
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Sockets & Chipsets */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Cpu className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            1. Zócalos de Procesador (PGA vs. LGA) y Chipsets
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Un procesador solo puede instalarse en una placa base con su mismo zócalo físico y soporte de microcódigo en BIOS/UEFI:
          </p>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                AMD Socket AM4 (PGA — 1331 pines en la CPU)
              </div>
              <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                Compatible con Ryzen series 3000/4000/5000. Chipsets habituales: A520 (básico, PCIe 3.0), B550 y X570 (PCIe 4.0). Exclusivo para memoria <strong>DDR4</strong>.
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                AMD Socket AM5 (LGA — 1718 contactos en la placa)
              </div>
              <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                Compatible con Ryzen series 7000/8000/9000. Chipsets: A620, B650, B650E, X670E. Exclusivo para memoria <strong>DDR5</strong>.
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                Intel Socket LGA1700 (LGA — 1700 contactos en la placa)
              </div>
              <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                Compatible con Intel Core 12ª, 13ª y 14ª Gen. Chipsets: H610 (gama entrada), B760 (gama media), Z790 (entusiasta/OC). Admite placas <strong>DDR4 o DDR5</strong> (según el modelo de placa base, nunca mezcladas).
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: RAM DDR4 vs DDR5 & Dual Channel */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <MemoryStick className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            2. Memoria RAM: DDR4 vs. DDR5 y Arquitectura Dual Channel
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Aunque tanto los módulos DIMM de escritorio DDR4 como DDR5 cuentan con 288 contactos, son física y eléctricamente incompatibles:
          </p>
          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
            <li className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-slate-100">Posición de la muesca (Key Notch):</strong> Desplazada varios milímetros para impedir insertar un módulo DDR5 en un zócalo DDR4.
            </li>
            <li className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-slate-100">Voltaje y regulación PMIC:</strong> DDR4 trabaja a 1.2V (1.35V XMP) regulados por la placa base; DDR5 baja a 1.1V e integra el chip regulador de tensión (PMIC) directamente en el módulo DIMM.
            </li>
            <li className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-slate-100">Dual Channel (Ranuras A2 y B2):</strong> Instalar 2 módulos iguales duplica el ancho de banda con el controlador IMC de la CPU (128 bits frente a 64 bits). En placas de 4 slots se instalan primero en los bancos 2 y 4 (A2/B2) para evitar reflexiones de señal.
            </li>
          </ul>
        </div>

        {/* Card 3: Physical Clearances & Form Factors */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Ruler className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            3. Geometría Mecánica y Factores de Forma en Milímetros
          </div>
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-slate-100">Estándares de Placa Base:</strong>
              <div className="font-mono mt-1">
                ATX: 305 × 244 mm · Micro-ATX: 244 × 244 mm · Mini-ITX: 170 × 170 mm
              </div>
              <div className="mt-1">
                Un chasis ATX suele admitir los tres formatos cambiando la posición de los separadores metálicos (standoffs). Un chasis Micro-ATX no puede alojar placas ATX.
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-slate-100">Altura del Disipador CPU:</strong> Los disipadores de doble torre (155–168 mm) chocan con el cristal lateral en cajas estrechas (cuyo límite suele ser 145–160 mm).
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-slate-100">Longitud de la Tarjeta Gráfica:</strong> Las GPUs de triple ventilador alcanzan 305–357 mm. Comprueba siempre el largo libre hasta el frontal del chasis.
            </div>
          </div>
        </div>

        {/* Card 4: Power Supply Sizing & POST Diagnostic */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Zap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            4. Cálculo de Fuente (PSU) y Códigos de Diagnóstico POST
          </div>
          <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-slate-100">Fórmula de Dimensionamiento PSU (+12V):</strong>
              <div className="font-mono mt-1 text-slate-800 dark:text-slate-200">
                P_recomendada = (CPU_Turbo + GPU_TBP + 50W_Resto) × 1.30
              </div>
              <div className="mt-1">
                Nunca te fíes solo de los vatios nominales de una fuente genérica: verifica la potencia real entregada en el raíl de <strong>+12V</strong> y la presencia de conectores PCIe de 8 pines o 12VHPWR.
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <strong className="text-slate-900 dark:text-slate-100">Secuencia EZ-Debug LED / AMI BIOS en el Arranque:</strong>
              <div className="mt-1 space-y-1 font-mono text-[11px]">
                <div>1. LED CPU → Comprueba procesador, socket y conector EPS 12V de 8 pines.</div>
                <div>2. LED DRAM → Entrenamiento de memoria RAM (AMI: 3 pitidos cortos si falla).</div>
                <div>3. LED VGA → Inicialización gráfica iGPU/PCIe (AMI: 1 pitido largo + 8 cortos si un procesador &ldquo;F&rdquo; no tiene gráfica dedicada; en Award son 1 largo + 2 cortos).</div>
                <div>4. LED BOOT → Búsqueda de partición EFI en unidad M.2 NVMe o SATA.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
