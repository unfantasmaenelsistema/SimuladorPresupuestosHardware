import {
  CompatibilityCheckItem,
  EvaluationResult,
  PCBuildState,
  UseCaseScenario,
} from '../types/hardware';

export interface PowerBreakdown {
  cpuBaseWatts: number;
  cpuMaxWatts: number;
  gpuWatts: number;
  motherboardAndFansWatts: number;
  ramWatts: number;
  storageWatts: number;
  totalTypicalWatts: number;
  totalMaxPeakWatts: number;
  recommendedPsuWatts: number;
  psuLoadPercentage: number;
}

export function calculatePowerBreakdown(build: PCBuildState): PowerBreakdown {
  const cpuBaseWatts = build.cpu ? build.cpu.tdpWatts : 0;
  const cpuMaxWatts = build.cpu ? build.cpu.maxTurboWatts : 0;
  const gpuWatts = build.gpu ? build.gpu.tdpWatts : 0;
  const motherboardAndFansWatts = build.motherboard ? 38 : 0;
  const ramWatts = build.ram ? build.ram.modules * 5 : 0;
  const storageWatts =
    (build.storagePrimary ? build.storagePrimary.watts : 0) +
    (build.storageSecondary ? build.storageSecondary.watts : 0);

  const totalTypicalWatts =
    cpuBaseWatts + Math.round(gpuWatts * 0.85) + motherboardAndFansWatts + ramWatts + storageWatts;
  const totalMaxPeakWatts =
    cpuMaxWatts + gpuWatts + motherboardAndFansWatts + ramWatts + storageWatts;

  const recommendedPsuWatts = Math.ceil((totalMaxPeakWatts * 1.3) / 50) * 50;

  const psuEffective = build.psu ? build.psu.effective12vWatts : 0;
  const psuLoadPercentage =
    psuEffective > 0 ? Math.round((totalMaxPeakWatts / psuEffective) * 100) : 0;

  return {
    cpuBaseWatts,
    cpuMaxWatts,
    gpuWatts,
    motherboardAndFansWatts,
    ramWatts,
    storageWatts,
    totalTypicalWatts,
    totalMaxPeakWatts,
    recommendedPsuWatts,
    psuLoadPercentage,
  };
}

export function calculateTotalPrice(build: PCBuildState): number {
  return (
    (build.cpu?.price ?? 0) +
    (build.motherboard?.price ?? 0) +
    (build.ram?.price ?? 0) +
    (build.cooler?.price ?? 0) +
    (build.gpu?.price ?? 0) +
    (build.storagePrimary?.price ?? 0) +
    (build.storageSecondary?.price ?? 0) +
    (build.pcCase?.price ?? 0) +
    (build.psu?.price ?? 0)
  );
}

export function runCompatibilityChecks(build: PCBuildState): CompatibilityCheckItem[] {
  const checks: CompatibilityCheckItem[] = [];
  const power = calculatePowerBreakdown(build);

  // 1. Socket CPU vs Placa Base
  if (!build.cpu || !build.motherboard) {
    checks.push({
      id: 'check-socket',
      category: 'Socket y Chipset',
      title: 'Zócalo CPU vs. Placa Base',
      severity: 'pending',
      summary: 'Selecciona procesador y placa base para verificar el socket.',
      technicalExplanation:
        'El zócalo (socket) debe coincidir física y eléctricamente entre el procesador y la placa base (AM4, AM5 o LGA1700).',
    });
  } else if (build.cpu.socket !== build.motherboard.socket) {
    checks.push({
      id: 'check-socket',
      category: 'Socket y Chipset',
      title: 'Incompatibilidad Física de Socket',
      severity: 'error',
      summary: `CPU ${build.cpu.socket} no encaja en placa base ${build.motherboard.socket}.`,
      technicalExplanation: `El procesador ${build.cpu.name} utiliza el socket ${build.cpu.socket}, mientras que la placa base ${build.motherboard.name} dispone de un zócalo ${build.motherboard.socket} (${build.motherboard.chipset}). Son mecánicamente y eléctricamente incompatibles: intentar forzarlo doblará los pines.`,
      measuredValue: `CPU: ${build.cpu.socket}`,
      limitValue: `Placa: ${build.motherboard.socket}`,
    });
  } else {
    checks.push({
      id: 'check-socket',
      category: 'Socket y Chipset',
      title: 'Zócalo CPU y Chipset Compatibles',
      severity: 'ok',
      summary: `Socket ${build.cpu.socket} verificado con chipset ${build.motherboard.chipset}.`,
      technicalExplanation: `Tanto ${build.cpu.name} como ${build.motherboard.name} comparten el estándar de zócalo ${build.cpu.socket} y microcódigo UEFI compatible.`,
      measuredValue: build.cpu.socket,
      limitValue: build.motherboard.chipset,
    });
  }

  // 2. VRM de Placa Base vs Consumo Turbo CPU
  if (build.cpu && build.motherboard && build.cpu.socket === build.motherboard.socket) {
    if (build.cpu.maxTurboWatts > build.motherboard.maxRecommendedCpuWatts) {
      checks.push({
        id: 'check-vrm',
        category: 'VRM Placa Base',
        title: 'Etapa de Potencia VRM Sobrecargada',
        severity: 'warning',
        summary: `Consumo Turbo de ${build.cpu.maxTurboWatts}W supera los ${build.motherboard.maxRecommendedCpuWatts}W recomendados del VRM.`,
        technicalExplanation: `Los reguladores de voltaje (MOSFETs del VRM) de la placa ${build.motherboard.name} están diseñados para sostener hasta ~${build.motherboard.maxRecommendedCpuWatts}W. Bajo carga multinúcleo prolongada, el ${build.cpu.name} (${build.cpu.maxTurboWatts}W MTP/PPT) sobrecalentará el VRM produciendo VRM Thermal Throttling.`,
        measuredValue: `${build.cpu.maxTurboWatts} W (CPU Turbo)`,
        limitValue: `${build.motherboard.maxRecommendedCpuWatts} W (Máx VRM)`,
      });
    } else {
      checks.push({
        id: 'check-vrm',
        category: 'VRM Placa Base',
        title: 'Etapa VRM Dimensionada Correctamente',
        severity: 'ok',
        summary: `El VRM soporta hasta ${build.motherboard.maxRecommendedCpuWatts}W para los ${build.cpu.maxTurboWatts}W Turbo de la CPU.`,
        technicalExplanation: `La entrega de energía de la placa base mantiene temperaturas seguras en los MOSFETs incluso al 100% de carga de todos los núcleos.`,
        measuredValue: `${build.cpu.maxTurboWatts} W`,
        limitValue: `≤ ${build.motherboard.maxRecommendedCpuWatts} W`,
      });
    }
  }

  // 3. Memoria RAM (DDR4/DDR5, nº de módulos y Dual Channel)
  if (!build.ram || !build.motherboard) {
    checks.push({
      id: 'check-ram',
      category: 'Memoria RAM',
      title: 'Estándar y Ranuras DIMM de Memoria RAM',
      severity: 'pending',
      summary: 'Selecciona placa base y kit de memoria RAM.',
      technicalExplanation:
        'Las memorias DDR4 y DDR5 tienen muescas físicas en distinta posición, voltajes distintos (1.2V vs 1.1V con PMIC en módulo) y no son retrocompatibles.',
    });
  } else {
    const typeMismatch = build.ram.ramType !== build.motherboard.ramType;
    const cpuRamMismatch =
      build.cpu && !build.cpu.supportedRam.includes(build.ram.ramType);
    const slotOverflow = build.ram.modules > build.motherboard.ramSlots;

    if (typeMismatch || cpuRamMismatch) {
      checks.push({
        id: 'check-ram',
        category: 'Memoria RAM',
        title: 'Incompatibilidad Física DDR4 vs DDR5',
        severity: 'error',
        summary: `Kit ${build.ram.ramType} no entra en ranuras ${build.motherboard.ramType} de la placa base.`,
        technicalExplanation: `Has seleccionado memoria ${build.ram.ramType} (${build.ram.name}), pero la placa base ${build.motherboard.name} utiliza bancos ${build.motherboard.ramType}. La muesca central del PCB está desplazada para impedir su inserción física.`,
        measuredValue: `RAM: ${build.ram.ramType}`,
        limitValue: `Placa: ${build.motherboard.ramType}`,
      });
    } else if (slotOverflow) {
      checks.push({
        id: 'check-ram',
        category: 'Memoria RAM',
        title: 'Insuficientes Ranuras DIMM en Placa Base',
        severity: 'error',
        summary: `Kit de ${build.ram.modules} módulos no cabe en placa de ${build.motherboard.ramSlots} ranuras DIMM.`,
        technicalExplanation: `El kit ${build.ram.name} consta de ${build.ram.modules} módulos físicos, pero la placa ${build.motherboard.name} solo dispone de ${build.motherboard.ramSlots} zócalos DIMM. Elige un kit de 2 módulos de mayor densidad (ej. 2x32 GB) o una placa con 4 ranuras.`,
        measuredValue: `${build.ram.modules} módulos`,
        limitValue: `${build.motherboard.ramSlots} ranuras DIMM`,
      });
    } else if (build.ram.modules === 1) {
      checks.push({
        id: 'check-ram',
        category: 'Memoria RAM',
        title: 'Memoria en Single Channel (Ancho de Banda Reducido)',
        severity: 'warning',
        summary: `1 solo módulo instalado (${build.ram.totalCapacityGb} GB): desaprovecha el bus Dual Channel.`,
        technicalExplanation: `Al instalar un único módulo DIMM, el controlador de memoria opera con un solo canal de 64 bits en lugar de 128 bits (Dual Channel), reduciendo el rendimiento en juegos, ofimática con iGPU y virtualización entre un 15% y un 30%.`,
        measuredValue: '1 módulo (Single Channel)',
        limitValue: '2 módulos (Dual Channel)',
      });
    } else {
      checks.push({
        id: 'check-ram',
        category: 'Memoria RAM',
        title: 'Memoria RAM y Dual Channel Correctos',
        severity: 'ok',
        summary: `${build.ram.totalCapacityGb} GB ${build.ram.ramType}-${build.ram.speedMhz} en ${build.ram.modules} módulos (${build.motherboard.ramSlots} slots en placa).`,
        technicalExplanation: `Estándar ${build.ram.ramType} verificado, número de módulos (${build.ram.modules}/${build.motherboard.ramSlots}) compatible y arquitectura Dual Channel activa.`,
        measuredValue: `${build.ram.modules}x${build.ram.capacityPerModuleGb} GB ${build.ram.ramType}`,
        limitValue: `${build.motherboard.ramSlots} DIMMs ${build.motherboard.ramType}`,
      });
    }
  }

  // 4. Salida de Vídeo (iGPU vs GPU Dedicada)
  if (!build.cpu || !build.gpu) {
    checks.push({
      id: 'check-video',
      category: 'Señal de Vídeo',
      title: 'Subsistema de Salida de Vídeo',
      severity: 'pending',
      summary: 'Selecciona CPU y opción gráfica para verificar la salida de vídeo.',
      technicalExplanation:
        'Para superar el POST de la BIOS/UEFI y mostrar imagen en el monitor, el sistema necesita una GPU integrada en el procesador (iGPU) o una tarjeta gráfica dedicada PCIe.',
    });
  } else if (build.gpu.id === 'gpu-igpu' && !build.cpu.hasIntegratedGraphics) {
    checks.push({
      id: 'check-video',
      category: 'Señal de Vídeo',
      title: 'Fallo POST: Equipo Sin Salida de Vídeo (LED VGA)',
      severity: 'error',
      summary: `${build.cpu.name} carece de gráficos integrados y no hay GPU dedicada seleccionada.`,
      technicalExplanation: `Los conectores HDMI/DisplayPort de la placa base dependen de la GPU integrada en el procesador. El ${build.cpu.name} no incluye iGPU (serie F de Intel o Ryzen sin gráficos integrados), por lo que la placa encenderá el LED de fallo VGA y no dará imagen. Instala una GPU dedicada o cambia a una CPU con iGPU.`,
      measuredValue: 'Sin iGPU ni GPU PCIe',
      limitValue: 'Requiere GPU o APU',
    });
  } else {
    const videoSource =
      build.gpu.id === 'gpu-igpu'
        ? `Gráficos integrados (${build.cpu.igpuName})`
        : `${build.gpu.name} (${build.gpu.vramGb} GB VRAM)`;
    checks.push({
      id: 'check-video',
      category: 'Señal de Vídeo',
      title: 'Señal de Vídeo Garantizada',
      severity: 'ok',
      summary: `Salida gráfica activa mediante ${videoSource}.`,
      technicalExplanation:
        build.gpu.id === 'gpu-igpu'
          ? `El procesador incluye ${build.cpu.igpuName}, habilitando los puertos de vídeo integrados en el panel trasero de la placa base.`
          : `El monitor debe conectarse directamente a las salidas HDMI/DisplayPort de la tarjeta dedicada ${build.gpu.name}.`,
      measuredValue: build.gpu.id === 'gpu-igpu' ? 'iGPU activa' : `${build.gpu.vramGb} GB VRAM`,
      limitValue: 'Señal OK',
    });
  }

  // 5. Geometría Física: Altura del Disipador vs Caja
  if (!build.cooler || !build.pcCase) {
    checks.push({
      id: 'check-cooler-clearance',
      category: 'Geometría Disipador',
      title: 'Holgura Física Disipador vs. Chasis',
      severity: 'pending',
      summary: 'Selecciona refrigeración de CPU y caja para comprobar dimensiones.',
      technicalExplanation:
        'La altura total del disipador por aire (desde el IHS del procesador hasta los heatpipes superiores) no puede superar la anchura interna admitida por el chasis.',
    });
  } else if (build.cooler.requiresAio240Mount && !build.pcCase.supportsAio240) {
    checks.push({
      id: 'check-cooler-clearance',
      category: 'Geometría Disipador',
      title: 'Chasis Sin Soporte para Radiador Líquido 240mm',
      severity: 'error',
      summary: `La caja ${build.pcCase.name} no dispone de anclajes para el radiador de 240mm.`,
      technicalExplanation: `El kit líquido ${build.cooler.name} incorpora un radiador doble de 240mm (~277 mm de marco total), pero el chasis compacto ${build.pcCase.name} carece de espacio y perforaciones para montarlo.`,
      measuredValue: 'Radiador AIO 240mm',
      limitValue: 'Chasis no admite AIO',
    });
  } else if (build.cooler.heightMm > build.pcCase.maxCoolerHeightMm) {
    const overflowMm = build.cooler.heightMm - build.pcCase.maxCoolerHeightMm;
    checks.push({
      id: 'check-cooler-clearance',
      category: 'Geometría Disipador',
      title: 'Colisión Mecánica: El Disipador No Cabe en la Caja',
      severity: 'error',
      summary: `El disipador mide ${build.cooler.heightMm} mm y sobresale ${overflowMm} mm del límite de la caja (${build.pcCase.maxCoolerHeightMm} mm).`,
      technicalExplanation: `El ${build.cooler.name} tiene una altura de ${build.cooler.heightMm} mm, superando el máximo de ${build.pcCase.maxCoolerHeightMm} mm permitido por ${build.pcCase.name}. ¡No podrás cerrar el panel lateral de la torre!`,
      measuredValue: `${build.cooler.heightMm} mm`,
      limitValue: `Máx ${build.pcCase.maxCoolerHeightMm} mm (-${overflowMm} mm)`,
    });
  } else {
    const clearanceMm = build.pcCase.maxCoolerHeightMm - build.cooler.heightMm;
    checks.push({
      id: 'check-cooler-clearance',
      category: 'Geometría Disipador',
      title: 'Altura de Disipador Compatible con el Chasis',
      severity: 'ok',
      summary: `Disipador de ${build.cooler.heightMm} mm dentro del límite de ${build.pcCase.maxCoolerHeightMm} mm (+${clearanceMm} mm de margen).`,
      technicalExplanation: `Quedan ${clearanceMm} mm de espacio libre entre la parte superior del disipador y el panel lateral del chasis ${build.pcCase.name}.`,
      measuredValue: `${build.cooler.heightMm} mm`,
      limitValue: `Máx ${build.pcCase.maxCoolerHeightMm} mm (+${clearanceMm} mm)`,
    });
  }

  // 6. Capacidad Térmica: TDP CPU vs Disipador
  if (!build.cpu || !build.cooler) {
    checks.push({
      id: 'check-tdp',
      category: 'Disipación Térmica (TDP)',
      title: 'Capacidad de Disipación Térmica (TDP)',
      severity: 'pending',
      summary: 'Selecciona CPU y disipador para calcular el balance térmico.',
      technicalExplanation:
        'El disipador debe evacuar tanto el TDP base como el calor generado en frecuencia Turbo máxima (MTP/PPT) para evitar Thermal Throttling.',
    });
  } else if (build.cooler.maxTdpWatts < build.cpu.tdpWatts) {
    checks.push({
      id: 'check-tdp',
      category: 'Disipación Térmica (TDP)',
      title: 'Sobrecalentamiento Crítico: Disipador Insuficiente',
      severity: 'error',
      summary: `El disipador solo evacúa ${build.cooler.maxTdpWatts}W frente a los ${build.cpu.tdpWatts}W base (${build.cpu.maxTurboWatts}W Turbo) de la CPU.`,
      technicalExplanation: `El ${build.cooler.name} está limitado a ${build.cooler.maxTdpWatts}W, incapaz de refrigerar un ${build.cpu.name} (${build.cpu.tdpWatts}W TDP / ${build.cpu.maxTurboWatts}W Turbo). El procesador alcanzará su temperatura crítica (TJMax 95-100 °C) sufriendo estrangulamiento térmico severo.`,
      measuredValue: `CPU: ${build.cpu.tdpWatts}W–${build.cpu.maxTurboWatts}W`,
      limitValue: `Cooler: ${build.cooler.maxTdpWatts}W máx`,
    });
  } else if (build.cooler.maxTdpWatts < build.cpu.maxTurboWatts) {
    checks.push({
      id: 'check-tdp',
      category: 'Disipación Térmica (TDP)',
      title: 'Refrigeración Justa para Carga Turbo Sostenida',
      severity: 'warning',
      summary: `El disipador (${build.cooler.maxTdpWatts}W) cubre el TDP base (${build.cpu.tdpWatts}W) pero va justo para el Turbo máximo (${build.cpu.maxTurboWatts}W).`,
      technicalExplanation: `En tareas ligeras u ofimática funcionará bien, pero al compilar, renderizar o virtualizar al 100% en todos los núcleos (${build.cpu.maxTurboWatts}W), las temperaturas rondarán los 90 °C con ruido elevado.`,
      measuredValue: `${build.cpu.maxTurboWatts}W Turbo`,
      limitValue: `${build.cooler.maxTdpWatts}W Cooler`,
    });
  } else {
    const headroomW = build.cooler.maxTdpWatts - build.cpu.maxTurboWatts;
    checks.push({
      id: 'check-tdp',
      category: 'Disipación Térmica (TDP)',
      title: 'Balance Térmico Óptimo',
      severity: 'ok',
      summary: `El disipador soporta ${build.cooler.maxTdpWatts}W para un consumo máximo de CPU de ${build.cpu.maxTurboWatts}W (+${headroomW}W margen).`,
      technicalExplanation: `La capacidad térmica del ${build.cooler.name} supera holgadamente el pico de disipación del procesador, manteniendo bajas temperaturas y sonoridad contenida.`,
      measuredValue: `${build.cpu.maxTurboWatts}W máx CPU`,
      limitValue: `${build.cooler.maxTdpWatts}W Cooler`,
    });
  }

  // 7. Geometría GPU vs Chasis
  if (!build.gpu || !build.pcCase) {
    checks.push({
      id: 'check-gpu-clearance',
      category: 'Geometría GPU',
      title: 'Longitud de Tarjeta Gráfica vs. Chasis',
      severity: 'pending',
      summary: 'Selecciona tarjeta gráfica y caja para verificar la longitud en mm.',
      technicalExplanation:
        'Las tarjetas gráficas de 2 y 3 ventiladores oscilan entre 200 mm y 360 mm; deben caber sin chocar con el frontal o los ventiladores del chasis.',
    });
  } else if (build.gpu.lengthMm > build.pcCase.maxGpuLengthMm) {
    const overflow = build.gpu.lengthMm - build.pcCase.maxGpuLengthMm;
    checks.push({
      id: 'check-gpu-clearance',
      category: 'Geometría GPU',
      title: 'Colisión Física: La Tarjeta Gráfica No Entra en el Chasis',
      severity: 'error',
      summary: `La GPU mide ${build.gpu.lengthMm} mm y excede en ${overflow} mm el espacio interno de la caja (${build.pcCase.maxGpuLengthMm} mm).`,
      technicalExplanation: `El ensamblaje de la ${build.gpu.name} tiene una longitud de ${build.gpu.lengthMm} mm, chocando contra el bastidor frontal del chasis ${build.pcCase.name} (máx ${build.pcCase.maxGpuLengthMm} mm).`,
      measuredValue: `${build.gpu.lengthMm} mm`,
      limitValue: `Máx ${build.pcCase.maxGpuLengthMm} mm (-${overflow} mm)`,
    });
  } else {
    const clearance = build.pcCase.maxGpuLengthMm - build.gpu.lengthMm;
    checks.push({
      id: 'check-gpu-clearance',
      category: 'Geometría GPU',
      title: 'Longitud de GPU Compatible con el Chasis',
      severity: 'ok',
      summary:
        build.gpu.lengthMm === 0
          ? 'Uso de iGPU integrada (0 mm ocupados en ranura PCIe x16).'
          : `GPU de ${build.gpu.lengthMm} mm compatible con límite de ${build.pcCase.maxGpuLengthMm} mm (+${clearance} mm libres).`,
      technicalExplanation:
        build.gpu.lengthMm === 0
          ? 'No se instala tarjeta dedicada en el slot PCIe x16.'
          : `Quedan ${clearance} mm de margen libre entre el extremo de la gráfica y el frontal del chasis.`,
      measuredValue: `${build.gpu.lengthMm} mm`,
      limitValue: `Máx ${build.pcCase.maxGpuLengthMm} mm`,
    });
  }

  // 8. Factor de Forma Placa Base vs Chasis
  if (!build.motherboard || !build.pcCase) {
    checks.push({
      id: 'check-form-factor',
      category: 'Formato Placa/Chasis',
      title: 'Factor de Forma Placa Base vs. Chasis',
      severity: 'pending',
      summary: 'Selecciona placa base y caja para comprobar el estándar mecánico (ATX / Micro-ATX / Mini-ITX).',
      technicalExplanation:
        'Una placa ATX estándar (305 × 244 mm) no cabe en cajas diseñadas exclusivamente para Micro-ATX (244 × 244 mm) o Mini-ITX (170 × 170 mm).',
    });
  } else if (!build.pcCase.supportedFormFactors.includes(build.motherboard.formFactor)) {
    checks.push({
      id: 'check-form-factor',
      category: 'Formato Placa/Chasis',
      title: 'Incompatibilidad de Factor de Forma (Placa vs. Caja)',
      severity: 'error',
      summary: `La placa ${build.motherboard.formFactor} no cabe en la caja ${build.pcCase.name} (solo admite ${build.pcCase.supportedFormFactors.join(', ')}).`,
      technicalExplanation: `La placa ${build.motherboard.name} es de formato ${build.motherboard.formFactor}, cuyas dimensiones superan la bandeja interior del chasis ${build.pcCase.name} (compatible únicamente con ${build.pcCase.supportedFormFactors.join(' / ')}).`,
      measuredValue: `Placa ${build.motherboard.formFactor}`,
      limitValue: `Admite: ${build.pcCase.supportedFormFactors.join(', ')}`,
    });
  } else {
    checks.push({
      id: 'check-form-factor',
      category: 'Formato Placa/Chasis',
      title: 'Factor de Forma Mecánico Compatible',
      severity: 'ok',
      summary: `Placa ${build.motherboard.formFactor} compatible con chasis (${build.pcCase.supportedFormFactors.join(', ')}).`,
      technicalExplanation: `Los separadores roscados (standoffs) y el escudo I/O trasero coinciden con el estándar ${build.motherboard.formFactor}.`,
      measuredValue: build.motherboard.formFactor,
      limitValue: build.pcCase.supportedFormFactors.join(' / '),
    });
  }

  // 9. Potencia de la Fuente (PSU) y Conectores PCIe
  if (!build.psu || !build.cpu || !build.motherboard) {
    checks.push({
      id: 'check-psu',
      category: 'Potencia Fuente (PSU)',
      title: 'Dimensionamiento Eléctrico de la Fuente (PSU)',
      severity: 'pending',
      summary: 'Selecciona CPU, placa, GPU y fuente de alimentación para calcular el balance de potencia.',
      technicalExplanation:
        'La fuente debe cubrir el pico máximo en la línea de +12V con al menos un 20–30% de margen de seguridad y disponer de los conectores PCIe requeridos.',
    });
  } else if (build.gpu?.requiresPciePowerConnector && !build.psu.hasPciePowerConnectors) {
    checks.push({
      id: 'check-psu',
      category: 'Potencia Fuente (PSU)',
      title: 'Fuente Sin Conectores de Alimentación PCIe para la GPU',
      severity: 'error',
      summary: `La fuente ${build.psu.name} carece de cables PCIe de 8 pines requeridos por ${build.gpu.name}.`,
      technicalExplanation: `Las tarjetas gráficas de más de 75W necesitan alimentación directa desde la fuente mediante conectores PCIe de 8 pines o 12VHPWR. Además, esta fuente genérica solo entrega ${build.psu.effective12vWatts}W reales en +12V.`,
      measuredValue: 'Sin cable PCIe 8-pin',
      limitValue: 'Requiere PCIe 8-pin / 12VHPWR',
    });
  } else if (power.totalMaxPeakWatts > build.psu.effective12vWatts) {
    checks.push({
      id: 'check-psu',
      category: 'Potencia Fuente (PSU)',
      title: 'Sobrecarga Eléctrica: Fuente de Alimentación Insuficiente',
      severity: 'error',
      summary: `Consumo pico de ${power.totalMaxPeakWatts}W supera los ${build.psu.effective12vWatts}W reales en +12V de la fuente.`,
      technicalExplanation: `Bajo carga combinada de CPU + GPU, el equipo demanda ${power.totalMaxPeakWatts}W, superando la capacidad del raíl de +12V de la ${build.psu.name} (${build.psu.effective12vWatts}W). Saltará la protección OPP/OCP provocando apagones bruscos o daños en componentes.`,
      measuredValue: `${power.totalMaxPeakWatts} W (Pico)`,
      limitValue: `${build.psu.effective12vWatts} W (+12V PSU)`,
    });
  } else if (power.psuLoadPercentage > 82) {
    checks.push({
      id: 'check-psu',
      category: 'Potencia Fuente (PSU)',
      title: 'Margen de Potencia Escaso ante Picos Transitorios',
      severity: 'warning',
      summary: `Carga del ${power.psuLoadPercentage}% (${power.totalMaxPeakWatts}W / ${build.psu.effective12vWatts}W). Se recomienda ≥ ${power.recommendedPsuWatts}W.`,
      technicalExplanation: `La fuente trabajará al ${power.psuLoadPercentage}% de su límite máximo. Las GPUs modernas generan picos de microsegundos (transients) superiores a su TBP nominal. Se recomienda un margen de al menos el 25% (fuente de ${power.recommendedPsuWatts}W o superior).`,
      measuredValue: `${power.totalMaxPeakWatts} W (${power.psuLoadPercentage}%)`,
      limitValue: `Rec: ≥ ${power.recommendedPsuWatts} W`,
    });
  } else {
    checks.push({
      id: 'check-psu',
      category: 'Potencia Fuente (PSU)',
      title: 'Fuente de Alimentación con Margen Seguro',
      severity: 'ok',
      summary: `Consumo pico de ${power.totalMaxPeakWatts}W sobre fuente de ${build.psu.wattage}W (${power.psuLoadPercentage}% de carga).`,
      technicalExplanation: `La fuente opera en su zona óptima de eficiencia (${build.psu.efficiency}) con holgura suficiente para absorber picos transitorios y futuras ampliaciones.`,
      measuredValue: `${power.totalMaxPeakWatts} W (${power.psuLoadPercentage}%)`,
      limitValue: `${build.psu.wattage} W (${build.psu.efficiency})`,
    });
  }

  // 10. Almacenamiento y Buses (M.2 / SATA / PCIe Gen)
  if (!build.storagePrimary || !build.motherboard) {
    checks.push({
      id: 'check-storage',
      category: 'Almacenamiento y Buses',
      title: 'Unidades de Almacenamiento e Interfaz',
      severity: 'pending',
      summary: 'Selecciona al menos la unidad de almacenamiento principal.',
      technicalExplanation:
        'Todo equipo requiere una unidad principal para el sistema operativo (preferiblemente SSD NVMe M.2) y ranuras suficientes en placa.',
    });
  } else {
    const nvmeCount =
      (build.storagePrimary.type === 'NVMe M.2' ? 1 : 0) +
      (build.storageSecondary?.type === 'NVMe M.2' ? 1 : 0);
    const hdd35Count =
      (build.storagePrimary.type === 'HDD 3.5"' ? 1 : 0) +
      (build.storageSecondary?.type === 'HDD 3.5"' ? 1 : 0);

    if (nvmeCount > build.motherboard.m2Slots) {
      checks.push({
        id: 'check-storage',
        category: 'Almacenamiento y Buses',
        title: 'Insuficientes Ranuras M.2 en Placa Base',
        severity: 'error',
        summary: `Has elegido ${nvmeCount} unidades NVMe M.2, pero la placa solo tiene ${build.motherboard.m2Slots} ranura(s) M.2.`,
        technicalExplanation: `La placa ${build.motherboard.name} solo cuenta con ${build.motherboard.m2Slots} zócalo(s) M.2. Cambia la unidad secundaria por un disco SATA III o elige una placa base con más ranuras M.2.`,
        measuredValue: `${nvmeCount} unidades M.2`,
        limitValue: `${build.motherboard.m2Slots} ranura(s) M.2`,
      });
    } else if (build.pcCase && hdd35Count > build.pcCase.driveBays35) {
      checks.push({
        id: 'check-storage',
        category: 'Almacenamiento y Buses',
        title: 'Insuficientes Bahías de 3.5" en el Chasis',
        severity: 'error',
        summary: `Seleccionados ${hdd35Count} discos de 3.5", pero la caja solo tiene ${build.pcCase.driveBays35} bahía(s) de 3.5".`,
        technicalExplanation: `El chasis ${build.pcCase.name} solo admite ${build.pcCase.driveBays35} disco(s) duro(s) mecánicos de formato 3.5 pulgadas.`,
        measuredValue: `${hdd35Count} HDD 3.5"`,
        limitValue: `${build.pcCase.driveBays35} bahías 3.5"`,
      });
    } else if (build.storagePrimary.type === 'HDD 3.5"') {
      checks.push({
        id: 'check-storage',
        category: 'Almacenamiento y Buses',
        title: 'Disco Mecánico HDD como Unidad Principal de Arranque',
        severity: 'warning',
        summary: `Un HDD mecánico (${build.storagePrimary.readSpeedMbs} MB/s) penalizará gravemente el arranque del sistema operativo.`,
        technicalExplanation: `Los discos magnéticos tienen altos tiempos de acceso (~12 ms) y bajas IOPS aleatorias. Utiliza siempre un SSD (idealmente M.2 NVMe) como unidad primaria y deja el HDD como almacenamiento secundario.`,
        measuredValue: `${build.storagePrimary.readSpeedMbs} MB/s (HDD)`,
        limitValue: 'Recomendado SSD NVMe',
      });
    } else {
      const storagePcieGen =
        build.storagePrimary.interface === 'NVMe PCIe 5.0'
          ? 5
          : build.storagePrimary.interface === 'NVMe PCIe 4.0'
          ? 4
          : 3;
      const effectivePcieGen = Math.min(
        build.cpu?.pcieVersion ?? 4,
        build.motherboard.maxPcieVersion
      );

      if ( build.storagePrimary.type === 'NVMe M.2' && storagePcieGen > effectivePcieGen ) {
        checks.push({
          id: 'check-storage',
          category: 'Almacenamiento y Buses',
          title: 'SSD NVMe Funcionando en Modo PCIe Inferior (Retrocompatible)',
          severity: 'warning',
          summary: `Unidad ${build.storagePrimary.interface} operará a velocidad PCIe ${effectivePcieGen}.0 por límite de CPU/Placa.`,
          technicalExplanation: `El protocolo PCIe es retrocompatible: el SSD ${build.storagePrimary.name} funcionará sin problemas, pero su velocidad secuencial máxima quedará limitada al ancho de banda PCIe ${effectivePcieGen}.0 (~3.500 MB/s en PCIe 3.0 o ~7.400 MB/s en PCIe 4.0).`,
          measuredValue: build.storagePrimary.interface,
          limitValue: `Bus PCIe ${effectivePcieGen}.0`,
        });
      } else {
        const totalCap =
          build.storagePrimary.capacityGb + (build.storageSecondary?.capacityGb ?? 0);
        checks.push({
          id: 'check-storage',
          category: 'Almacenamiento y Buses',
          title: 'Subsistema de Almacenamiento Óptimo',
          severity: 'ok',
          summary: `Capacidad total: ${totalCap >= 1000 ? `${(totalCap / 1000).toFixed(1)} TB` : `${totalCap} GB`} (${build.storagePrimary.interface}).`,
          technicalExplanation: `Las interfaces de almacenamiento y ranuras M.2/SATA están correctamente asignadas sin cuellos de botella de bus.`,
          measuredValue: `${build.storagePrimary.readSpeedMbs} MB/s`,
          limitValue: `${nvmeCount}/${build.motherboard.m2Slots} M.2 ocupados`,
        });
      }
    }
  }

  return checks;
}

export function evaluateBuild(
  build: PCBuildState,
  scenario: UseCaseScenario,
  customBudget: number
): EvaluationResult {
  const checks = runCompatibilityChecks(build);
  const power = calculatePowerBreakdown(build);
  const totalPrice = calculateTotalPrice(build);

  const requiredSlots: (keyof PCBuildState)[] = [
    'cpu',
    'motherboard',
    'ram',
    'cooler',
    'gpu',
    'storagePrimary',
    'pcCase',
    'psu',
  ];
  const missingCount = requiredSlots.filter((slot) => build[slot] === null).length;

  const errorChecks = checks.filter((c) => c.severity === 'error');
  const warningChecks = checks.filter((c) => c.severity === 'warning');

  const canBoot = missingCount === 0 && errorChecks.length === 0;

  // 1. Compatibility Score (Max 4.0 pts)
  let compatibilityScore = 4.0;
  if (missingCount > 0) {
    compatibilityScore = Math.max(0, 4.0 - missingCount * 0.6);
  } else {
    compatibilityScore = Math.max(
      0,
      4.0 - errorChecks.length * 1.5 - warningChecks.length * 0.35
    );
  }

  // 2. Budget Score (Max 2.0 pts)
  let budgetScore = 0;
  if (missingCount === 0) {
    if (totalPrice <= customBudget) {
      // Reward staying within budget without under-spending ridiculously (< 45% of budget)
      const utilization = totalPrice / customBudget;
      budgetScore = utilization >= 0.5 ? 2.0 : 1.5;
    } else {
      const overPercent = ((totalPrice - customBudget) / customBudget) * 100;
      if (overPercent <= 5) budgetScore = 1.2;
      else if (overPercent <= 12) budgetScore = 0.6;
      else budgetScore = 0;
    }
  }

  // 3. Use Case Adequacy Checklist & Score (Max 2.5 pts)
  const checklist: { label: string; met: boolean; detail: string }[] = [];

  // Budget check item
  checklist.push({
    label: `Presupuesto ≤ ${customBudget} €`,
    met: totalPrice > 0 && totalPrice <= customBudget,
    detail:
      totalPrice <= customBudget
        ? `Coste actual: ${totalPrice} € (Ahorro de ${customBudget - totalPrice} €)`
        : `Excedido en +${totalPrice - customBudget} € (${totalPrice} € / ${customBudget} €)`,
  });

  // CPU Cores & Performance check
  const cpuCoresMet = (build.cpu?.cores ?? 0) >= scenario.minCpuCores;
  const cpuMultiMet = (build.cpu?.multicoreScore ?? 0) >= scenario.minCpuMulticoreScore;
  checklist.push({
    label: `Procesador ≥ ${scenario.minCpuCores} núcleos y solvencia para ${scenario.shortTitle}`,
    met: Boolean(build.cpu && cpuCoresMet && cpuMultiMet),
    detail: build.cpu
      ? `${build.cpu.name} (${build.cpu.cores} núcleos / ${build.cpu.threads} hilos)`
      : 'Pendiente de seleccionar CPU',
  });

  // RAM capacity & Dual Channel
  const ramCapMet = (build.ram?.totalCapacityGb ?? 0) >= scenario.minRamGb;
  const dualChannelMet = !scenario.recommendedDualChannel || (build.ram?.modules ?? 0) >= 2;
  checklist.push({
    label: `Memoria RAM ≥ ${scenario.minRamGb} GB${scenario.recommendedDualChannel ? ' en Dual Channel' : ''}`,
    met: Boolean(build.ram && ramCapMet && dualChannelMet),
    detail: build.ram
      ? `${build.ram.totalCapacityGb} GB (${build.ram.modules}x${build.ram.capacityPerModuleGb} GB ${build.ram.ramType})`
      : 'Pendiente de seleccionar RAM',
  });

  // GPU / Graphics requirement
  if (scenario.requiresDedicatedGpu) {
    const gpuMet =
      Boolean(build.gpu) &&
      build.gpu!.id !== 'gpu-igpu' &&
      build.gpu!.vramGb >= scenario.minVramGb &&
      build.gpu!.gamingScore >= scenario.minGamingScore;
    checklist.push({
      label: `GPU dedicada con ≥ ${scenario.minVramGb} GB VRAM`,
      met: gpuMet,
      detail: build.gpu
        ? `${build.gpu.name} (${build.gpu.vramGb} GB VRAM)`
        : 'Pendiente de seleccionar GPU',
    });
  } else if (scenario.id === 'ofimatica') {
    const lowPowerMet = power.totalMaxPeakWatts > 0 && power.totalMaxPeakWatts <= 250;
    checklist.push({
      label: 'Eficiencia energética de oficina (Consumo pico ≤ 250 W)',
      met: lowPowerMet,
      detail: `Consumo pico estimado: ${power.totalMaxPeakWatts} W`,
    });
  }

  // Storage capacity & Secondary storage
  const totalStorageGb =
    (build.storagePrimary?.capacityGb ?? 0) + (build.storageSecondary?.capacityGb ?? 0);
  const storageMet =
    Boolean(build.storagePrimary) &&
    build.storagePrimary!.type !== 'HDD 3.5"' &&
    totalStorageGb >= scenario.minStorageGb &&
    (!scenario.requiresSecondaryStorage || Boolean(build.storageSecondary));

  checklist.push({
    label: scenario.requiresSecondaryStorage
      ? `SSD Principal + Unidad Secundaria de datos/backups (Total ≥ ${scenario.minStorageGb} GB)`
      : `Almacenamiento SSD rápido ≥ ${scenario.minStorageGb} GB`,
    met: storageMet,
    detail: build.storagePrimary
      ? `${build.storagePrimary.name}${build.storageSecondary ? ` + ${build.storageSecondary.name}` : ''}`
      : 'Pendiente de seleccionar almacenamiento',
  });

  const metCriteriaCount = checklist.filter((item) => item.met).length;
  const useCaseScore =
    missingCount === 0
      ? Number(((metCriteriaCount / checklist.length) * 2.5).toFixed(2))
      : Number(((metCriteriaCount / checklist.length) * 1.2).toFixed(2));

  // 4. Thermal & Electrical Balance Score (Max 1.5 pts)
  let balanceScore = 0;
  if (missingCount === 0 && errorChecks.length === 0) {
    balanceScore = 1.5;
    if (warningChecks.length > 0) {
      balanceScore = Math.max(0.4, 1.5 - warningChecks.length * 0.4);
    }
    // Check CPU/GPU bottleneck in gaming
    if (
      scenario.id === 'gaming' &&
      build.cpu &&
      build.gpu &&
      Math.abs(build.cpu.gamingScore - build.gpu.gamingScore) > 32
    ) {
      balanceScore = Math.max(0.5, balanceScore - 0.4);
    }
  }

  // If there are critical physical/logical errors that prevent booting, cap total score at 4.5 (Suspenso en taller)
  let rawTotal = compatibilityScore + budgetScore + useCaseScore + balanceScore;
  if (!canBoot && missingCount === 0) {
    rawTotal = Math.min(4.5, rawTotal);
  }
  const totalScore = Number(Math.min(10, Math.max(0, rawTotal)).toFixed(1));

  const feedback: string[] = [];
  if (missingCount > 0) {
    feedback.push(`Faltan ${missingCount} componente(s) obligatorios para completar el montaje de la torre.`);
  }
  errorChecks.forEach((err) => {
    feedback.push(`ERROR CRÍTICO (${err.category}): ${err.summary}`);
  });
  warningChecks.forEach((warn) => {
    feedback.push(`OBSERVACIÓN TÉCNICA (${warn.category}): ${warn.summary}`);
  });
  if (totalPrice > customBudget) {
    feedback.push(
      `DESVIACIÓN PRESUPUESTARIA: El montaje cuesta ${totalPrice} €, superando en ${totalPrice - customBudget} € el presupuesto máximo fijado (${customBudget} €).`
    );
  }
  if (canBoot && warningChecks.length === 0 && totalPrice <= customBudget && metCriteriaCount === checklist.length) {
    feedback.push(
      '¡Montaje sobresaliente! Todos los componentes son 100% compatibles física y lógicamente, cumplen los requisitos del cliente y respetan el presupuesto.'
    );
  }

  let verdictTitle = 'Montaje Incompleto';
  if (missingCount === 0) {
    if (!canBoot) verdictTitle = 'No Arranca / Incompatibilidad Física o Lógica (NO APTO)';
    else if (totalScore >= 9) verdictTitle = 'Sobresaliente — Montaje Profesional Certificado';
    else if (totalScore >= 7) verdictTitle = 'Notable — Equipo Funcional con Margen de Optimización';
    else if (totalScore >= 5) verdictTitle = 'Aprobado — Funcional pero Desajustado al Caso de Uso o Presupuesto';
    else verdictTitle = 'Insuficiente — Requiere Correcciones de Presupuesto o Diseño';
  }

  return {
    totalScore,
    compatibilityScore: Number(compatibilityScore.toFixed(1)),
    budgetScore: Number(budgetScore.toFixed(1)),
    useCaseScore: Number(useCaseScore.toFixed(1)),
    balanceScore: Number(balanceScore.toFixed(1)),
    canBoot,
    verdictTitle,
    verdictFeedback: feedback,
    useCaseChecklist: checklist,
  };
}
