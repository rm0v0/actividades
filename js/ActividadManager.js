class ActividadManager {
  static calcularPedido(pedido, precioUnitario) {
    const cantidad = Number(pedido.cantidad) || 0;
    const precio = Number(precioUnitario) || 0;
    const pagado = Number(pedido.monto_pagado) || 0;

    const total = cantidad * precio;
    const saldo = Math.max(0, total - pagado);

    let estado = 'Pendiente';
    let claseEstado = 'estado-pendiente';

    if (saldo === 0 && total > 0) {
      estado = 'Pagado';
      claseEstado = 'estado-pagado';
    } else if (pagado > 0 && saldo > 0) {
      estado = 'Adelanto / Parcial';
      claseEstado = 'estado-parcial';
    }

    return { total, pagado, saldo, estado, claseEstado };
  }

  static calcularBalance(actividad, pedidos, gastos, donaciones) {
    const precioUnitario = Number(actividad.precio_unitario) || 0;

    let totalUnidades = 0;
    let totalVendido = 0;
    let totalRecaudado = 0;

    pedidos.forEach((p) => {
      const cantidad = Number(p.cantidad) || 0;
      const pagado = Number(p.monto_pagado) || 0;
      totalUnidades += cantidad;
      totalVendido += cantidad * precioUnitario;
      totalRecaudado += pagado;
    });

    const totalPorCobrar = Math.max(0, totalVendido - totalRecaudado);

    const totalGastos = gastos.reduce(
      (acum, g) => acum + (Number(g.costo) || 0),
      0
    );

    // Solo las donaciones de DINERO restan a los gastos monetarios
    const totalDonacionesDinero = donaciones
      .filter((d) => d.tipo !== 'ingrediente')
      .reduce((acum, d) => acum + (Number(d.monto) || 0), 0);

    // Los ingredientes donados se cuentan como insumos cubiertos
    const cantidadInsumosDonados = donaciones.filter(
      (d) => d.tipo === 'ingrediente'
    ).length;

    const gastoRealBolsillo = Math.max(0, totalGastos - totalDonacionesDinero);
    const gananciaNeta = totalVendido - gastoRealBolsillo;
    const efectivoLibreEnCaja = totalRecaudado - gastoRealBolsillo;

    const porcentajeCobrado =
      totalVendido > 0 ? Math.round((totalRecaudado / totalVendido) * 100) : 0;

    return {
      totalUnidades,
      totalGastos,
      totalDonacionesDinero,
      cantidadInsumosDonados,
      gastoRealBolsillo,
      totalVendido,
      totalRecaudado,
      totalPorCobrar,
      gananciaNeta,
      efectivoLibreEnCaja,
      porcentajeCobrado
    };
  }

  static formatearSoles(monto) {
    return `S/ ${Number(monto || 0).toFixed(2)}`;
  }
}