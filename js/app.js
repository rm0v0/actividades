class AppController {
  constructor() {
    this.db = new SupabaseService(SUPABASE_CONFIG);
    this.actividadesActuales = [];
    this.actividadActual = null;
    this.pedidosActuales = [];
    this.gastosActuales = [];
    this.donacionesActuales = [];
    this.filtroDonaciones = 'todos';

    this.inicializarEventos();
    this.verificarSesion();
  }

  mostrarVista(idVista) {
    document.querySelectorAll('.vista').forEach((v) => (v.hidden = true));
    document.getElementById(idVista).hidden = false;
  }

  async verificarSesion() {
    try {
      const usuario = await this.db.obtenerUsuarioActual();
      if (usuario) {
        await this.cargarActividades();
        this.mostrarVista('vista-actividades');
      } else {
        this.mostrarVista('vista-login');
      }
    } catch (error) {
      console.error(error);
      this.mostrarVista('vista-login');
    }
  }

  // Redondea a 2 decimales para evitar errores de precisión (ej. 3 * 2.5 = 7.50)
  redondearMoneda(valor) {
    return Math.round((Number(valor) || 0) * 100) / 100;
  }

  // Valida que el adelanto no supere el total en Nuevo Pedido
  validarAdelantoNuevoPedido() {
    const modoPago = document.getElementById('ped-modo-pago').value;
    const inputAdelanto = document.getElementById('ped-adelanto-monto');
    const msgError = document.getElementById('ped-adelanto-error');

    if (modoPago !== 'adelanto') {
      inputAdelanto.classList.remove('input-error');
      msgError.hidden = true;
      return true;
    }

    const cant = Number(document.getElementById('ped-cantidad').value) || 0;
    const precio = this.actividadActual ? Number(this.actividadActual.precio_unitario) : 0;
    const total = this.redondearMoneda(cant * precio);
    const adelanto = this.redondearMoneda(inputAdelanto.value);

    if (adelanto > total) {
      inputAdelanto.classList.add('input-error');
      msgError.textContent = `El adelanto no puede superar el total (${ActividadManager.formatearSoles(total)}).`;
      msgError.hidden = false;
      return false;
    }

    inputAdelanto.classList.remove('input-error');
    msgError.hidden = true;
    return true;
  }

  // Valida que el monto pagado no supere el total al Editar Pedido
  validarPagoEditarPedido() {
    const inputPagado = document.getElementById('edit-ped-pagado');
    const msgError = document.getElementById('edit-ped-error');

    const cant = Number(document.getElementById('edit-ped-cantidad').value) || 0;
    const precio = this.actividadActual ? Number(this.actividadActual.precio_unitario) : 0;
    const total = this.redondearMoneda(cant * precio);
    const pagado = this.redondearMoneda(inputPagado.value);

    if (pagado > total) {
      inputPagado.classList.add('input-error');
      msgError.textContent = `El monto pagado no puede superar el total (${ActividadManager.formatearSoles(total)}).`;
      msgError.hidden = false;
      return false;
    }

    inputPagado.classList.remove('input-error');
    msgError.hidden = true;
    return true;
  }

  inicializarEventos() {
    // Login
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const msgError = document.getElementById('login-error');

      try {
        msgError.hidden = true;
        await this.db.iniciarSesion(email, password);
        await this.cargarActividades();
        this.mostrarVista('vista-actividades');
      } catch (err) {
        msgError.textContent = 'Correo o contraseña incorrectos.';
        msgError.hidden = false;
      }
    });

    // Modo Oscuro / Claro
    const btnTema = document.getElementById('btn-tema');
    if (localStorage.getItem('tema') === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      btnTema.textContent = '☀️ Modo claro';
    }

    btnTema.addEventListener('click', () => {
      const esOscuro = document.documentElement.getAttribute('data-theme') === 'dark';
      if (esOscuro) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('tema', 'light');
        btnTema.textContent = '🌙 Modo oscuro';
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('tema', 'dark');
        btnTema.textContent = '☀️ Modo claro';
      }
    });

    // Volver al historial
    document.getElementById('btn-volver').addEventListener('click', async () => {
      this.actividadActual = null;
      await this.cargarActividades();
      this.mostrarVista('vista-actividades');
    });

    // Barra de navegación inferior
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('activo'));
        document.querySelectorAll('.tab-contenido').forEach((c) => (c.hidden = true));

        btn.classList.add('activo');
        document.getElementById(btn.dataset.tab).hidden = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // Subpestañas internas
    document.querySelectorAll('.subtab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const contenedorPadre = btn.closest('.tab-contenido, .vista');
        contenedorPadre.querySelectorAll(':scope > .subtabs .subtab-btn').forEach((b) => b.classList.remove('activo'));
        contenedorPadre.querySelectorAll(':scope > .subtab-contenido').forEach((c) => (c.hidden = true));

        btn.classList.add('activo');
        document.getElementById(btn.dataset.target).hidden = false;
      });
    });

    // Buscador por nombre y filtro por mes en Historial de Actividades
    const inputActNombre = document.getElementById('buscar-act-nombre');
    const inputActMes = document.getElementById('buscar-act-mes');
    const btnLimpiarAct = document.getElementById('btn-limpiar-act');

    const actualizarFiltroActividades = () => {
      const hayFiltro = inputActNombre.value.trim() !== '' || inputActMes.value !== '';
      btnLimpiarAct.hidden = !hayFiltro;
      this.renderizarActividades();
    };

    inputActNombre.addEventListener('input', actualizarFiltroActividades);
    inputActMes.addEventListener('change', actualizarFiltroActividades);

    btnLimpiarAct.addEventListener('click', () => {
      inputActNombre.value = '';
      inputActMes.value = '';
      btnLimpiarAct.hidden = true;
      this.renderizarActividades();
    });

    // Filtros en Lista de Donaciones
    document.querySelectorAll('.filtro-don-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filtro-don-btn').forEach((b) => b.classList.remove('activo'));
        btn.classList.add('activo');
        this.filtroDonaciones = btn.dataset.filtro;
        this.renderizarDonaciones();
      });
    });

    // Buscador en tiempo real en Lista de Pedidos
    document.getElementById('buscar-pedido').addEventListener('input', () => {
      this.renderizarPedidos();
    });

    // Crear actividad
    document.getElementById('form-nueva-actividad').addEventListener('submit', async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('act-nombre').value.trim();
      const fecha = document.getElementById('act-fecha').value;
      const precio = parseFloat(document.getElementById('act-precio').value);

      await this.db.crearActividad(nombre, fecha, precio);
      e.target.reset();
      await this.cargarActividades();
      document.getElementById('tab-btn-historial').click();
    });

    // Cálculo automático del Total a pagar en Nuevo Pedido + revalidación de adelanto
    document.getElementById('ped-cantidad').addEventListener('input', (e) => {
      const cant = Number(e.target.value) || 0;
      const precio = this.actividadActual ? Number(this.actividadActual.precio_unitario) : 0;
      const total = this.redondearMoneda(cant * precio);

      document.getElementById('ped-preview-total').textContent =
        ActividadManager.formatearSoles(total);
      document.getElementById('ped-adelanto-monto').max = total;

      this.validarAdelantoNuevoPedido();
    });

    // Validación en tiempo real al escribir el monto del adelanto
    document.getElementById('ped-adelanto-monto').addEventListener('input', () => {
      this.validarAdelantoNuevoPedido();
    });

    // Botones opcionales: "Canceló todo" vs "Adelanto"
    document.querySelectorAll('.pago-opt-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const yaEstabaActivo = btn.classList.contains('activo');
        document.querySelectorAll('.pago-opt-btn').forEach((b) => b.classList.remove('activo'));

        const inputModo = document.getElementById('ped-modo-pago');
        const grupoAdelanto = document.getElementById('grupo-ped-adelanto');
        const inputAdelanto = document.getElementById('ped-adelanto-monto');

        if (yaEstabaActivo) {
          inputModo.value = 'ninguno';
          grupoAdelanto.hidden = true;
          inputAdelanto.required = false;
          inputAdelanto.value = '';
          this.validarAdelantoNuevoPedido();
          return;
        }

        btn.classList.add('activo');
        const modo = btn.dataset.modo;
        inputModo.value = modo;

        if (modo === 'adelanto') {
          grupoAdelanto.hidden = false;
          inputAdelanto.required = true;
          inputAdelanto.focus();
          this.validarAdelantoNuevoPedido();
        } else {
          grupoAdelanto.hidden = true;
          inputAdelanto.required = false;
          inputAdelanto.value = '';
          this.validarAdelantoNuevoPedido();
        }
      });
    });

    // Crear pedido (bloquea si el adelanto es mayor al total)
    document.getElementById('form-nuevo-pedido').addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!this.validarAdelantoNuevoPedido()) {
        document.getElementById('ped-adelanto-monto').focus();
        return;
      }

      const cliente = document.getElementById('ped-cliente').value.trim();
      const cantidad = parseInt(document.getElementById('ped-cantidad').value, 10);
      const precioUnitario = Number(this.actividadActual.precio_unitario) || 0;
      const total = this.redondearMoneda(cantidad * precioUnitario);

      const modoPago = document.getElementById('ped-modo-pago').value;
      let pagado = 0;

      if (modoPago === 'todo') {
        pagado = total;
      } else if (modoPago === 'adelanto') {
        pagado = this.redondearMoneda(document.getElementById('ped-adelanto-monto').value);
      }

      await this.db.crearPedido(this.actividadActual.id, cliente, cantidad, pagado);
      e.target.reset();
      this.resetearFormularioPedido();
      await this.recargarDetalleActividad();
    });

    // Validación en tiempo real al editar pedido
    document.getElementById('edit-ped-cantidad').addEventListener('input', () => {
      this.validarPagoEditarPedido();
    });
    document.getElementById('edit-ped-pagado').addEventListener('input', () => {
      this.validarPagoEditarPedido();
    });

    // Guardar edición de pedido
    document.getElementById('form-editar-pedido').addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!this.validarPagoEditarPedido()) {
        document.getElementById('edit-ped-pagado').focus();
        return;
      }

      const id = document.getElementById('edit-ped-id').value;
      const cliente = document.getElementById('edit-ped-cliente').value.trim();
      const cantidad = parseInt(document.getElementById('edit-ped-cantidad').value, 10);
      const monto_pagado = this.redondearMoneda(document.getElementById('edit-ped-pagado').value);

      await this.db.actualizarPedido(id, { cliente, cantidad, monto_pagado });
      document.getElementById('box-editar-pedido').hidden = true;
      await this.recargarDetalleActividad();
    });

    document.getElementById('btn-cancelar-edicion').addEventListener('click', () => {
      document.getElementById('box-editar-pedido').hidden = true;
      document.getElementById('edit-ped-pagado').classList.remove('input-error');
      document.getElementById('edit-ped-error').hidden = true;
    });

    // Crear gasto
    document.getElementById('form-nuevo-gasto').addEventListener('submit', async (e) => {
      e.preventDefault();
      const descripcion = document.getElementById('gas-descripcion').value.trim();
      const costo = parseFloat(document.getElementById('gas-costo').value);

      await this.db.crearGasto(this.actividadActual.id, descripcion, costo);
      e.target.reset();
      await this.recargarDetalleActividad();
    });

    // Selector tipo de donación (Dinero vs Ingrediente)
    document.querySelectorAll('.tipo-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tipo-btn').forEach((b) => b.classList.remove('activo'));
        btn.classList.add('activo');

        const tipo = btn.dataset.tipo;
        document.getElementById('don-tipo').value = tipo;

        const grupoMonto = document.getElementById('grupo-don-monto');
        const grupoIngrediente = document.getElementById('grupo-don-ingrediente');
        const inputMonto = document.getElementById('don-monto');
        const inputIngrediente = document.getElementById('don-ingrediente');

        if (tipo === 'dinero') {
          grupoMonto.hidden = false;
          grupoIngrediente.hidden = true;
          inputMonto.required = true;
          inputIngrediente.required = false;
        } else {
          grupoMonto.hidden = true;
          grupoIngrediente.hidden = false;
          inputMonto.required = false;
          inputIngrediente.required = true;
        }
      });
    });

    // Crear donación
    document.getElementById('form-nueva-donacion').addEventListener('submit', async (e) => {
      e.preventDefault();
      const tipo = document.getElementById('don-tipo').value;
      const donante = document.getElementById('don-donante').value.trim();

      let detalle = '';
      let monto = 0;

      if (tipo === 'dinero') {
        monto = parseFloat(document.getElementById('don-monto').value) || 0;
        detalle = 'Aporte en efectivo';
      } else {
        detalle = document.getElementById('don-ingrediente').value.trim();
        monto = 0;
      }

      await this.db.crearDonacion(this.actividadActual.id, tipo, donante, detalle, monto);
      e.target.reset();
      document.querySelector('.tipo-btn[data-tipo="dinero"]').click();
      await this.recargarDetalleActividad();
    });
  }

  resetearFormularioPedido() {
    document.getElementById('ped-preview-total').textContent = 'S/ 0.00';
    document.getElementById('ped-modo-pago').value = 'ninguno';
    document.querySelectorAll('.pago-opt-btn').forEach((b) => b.classList.remove('activo'));
    const grupoAdelanto = document.getElementById('grupo-ped-adelanto');
    const inputAdelanto = document.getElementById('ped-adelanto-monto');
    const msgError = document.getElementById('ped-adelanto-error');

    grupoAdelanto.hidden = true;
    inputAdelanto.required = false;
    inputAdelanto.value = '';
    inputAdelanto.classList.remove('input-error');
    msgError.hidden = true;
  }

  resetearNavegacionDetalle() {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('activo'));
    document.querySelectorAll('.tab-contenido').forEach((c) => (c.hidden = true));

    document.querySelector('.nav-item[data-tab="tab-pedidos"]').classList.add('activo');
    document.getElementById('tab-pedidos').hidden = false;

    document.querySelectorAll('.tab-contenido').forEach((seccion) => {
      const botones = seccion.querySelectorAll('.subtab-btn');
      const paneles = seccion.querySelectorAll('.subtab-contenido');
      if (botones.length > 0) {
        botones.forEach((b) => b.classList.remove('activo'));
        paneles.forEach((p) => (p.hidden = true));
        botones[0].classList.add('activo');
        paneles[0].hidden = false;
      }
    });

    this.filtroDonaciones = 'todos';
    document.querySelectorAll('.filtro-don-btn').forEach((b) => b.classList.remove('activo'));
    document.querySelector('.filtro-don-btn[data-filtro="todos"]').classList.add('activo');

    document.getElementById('form-nuevo-pedido').reset();
    this.resetearFormularioPedido();
    document.getElementById('buscar-pedido').value = '';
    document.getElementById('box-editar-pedido').hidden = true;
  }

  async cargarActividades() {
    this.actividadesActuales = await this.db.listarActividades();
    this.renderizarActividades();
  }

  renderizarActividades() {
    const contenedor = document.getElementById('lista-actividades');
    contenedor.innerHTML = '';

    const filtroNombre = this.normalizarTexto(document.getElementById('buscar-act-nombre').value.trim());
    const filtroMes = document.getElementById('buscar-act-mes').value;

    const filtradas = this.actividadesActuales.filter((act) => {
      const coincideNombre = !filtroNombre || this.normalizarTexto(act.nombre).includes(filtroNombre);
      const coincideMes = !filtroMes || (act.fecha && act.fecha.startsWith(filtroMes));
      return coincideNombre && coincideMes;
    });

    if (filtradas.length === 0) {
      const hayFiltro = filtroNombre !== '' || filtroMes !== '';
      contenedor.innerHTML = hayFiltro
        ? '<p class="texto-vacio">No se encontraron actividades con ese filtro.</p>'
        : '<p class="texto-vacio">Aún no hay actividades registradas. Crea una en "Nueva actividad".</p>';
      return;
    }

    filtradas.forEach((act) => {
      const card = document.createElement('article');
      card.className = 'card item-actividad';
      card.innerHTML = `
        <div>
          <h3>${this.escaparHTML(act.nombre)}</h3>
          <p>Fecha: ${act.fecha} | Precio: ${ActividadManager.formatearSoles(act.precio_unitario)}</p>
        </div>
        <div class="acciones-fila">
          <button class="btn btn-primario btn-abrir">Abrir</button>
          <button class="btn btn-peligro btn-eliminar">Eliminar</button>
        </div>
      `;

      card.querySelector('.btn-abrir').addEventListener('click', () => this.abrirActividad(act));
      card.querySelector('.btn-eliminar').addEventListener('click', async () => {
        if (confirm(`¿Eliminar "${act.nombre}" y todos sus registros?`)) {
          await this.db.eliminarActividad(act.id);
          await this.cargarActividades();
        }
      });

      contenedor.appendChild(card);
    });
  }

  async abrirActividad(actividad) {
    this.actividadActual = actividad;
    document.getElementById('detalle-titulo').textContent = actividad.nombre;
    document.getElementById('detalle-subtitulo').textContent =
      `${actividad.fecha} | Unidad: ${ActividadManager.formatearSoles(actividad.precio_unitario)}`;

    this.resetearNavegacionDetalle();
    await this.recargarDetalleActividad();
    this.mostrarVista('vista-detalle');
  }

  async recargarDetalleActividad() {
    const id = this.actividadActual.id;
    const [pedidos, gastos, donaciones] = await Promise.all([
      this.db.listarPedidos(id),
      this.db.listarGastos(id),
      this.db.listarDonaciones(id)
    ]);

    this.pedidosActuales = pedidos;
    this.gastosActuales = gastos;
    this.donacionesActuales = donaciones;

    this.renderizarPedidos();
    this.renderizarGastos();
    this.renderizarDonaciones();
    this.renderizarBalance();
  }

  normalizarTexto(texto) {
    return (texto || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  renderizarPedidos() {
    const contenedor = document.getElementById('lista-pedidos');
    contenedor.innerHTML = '';

    const filtro = this.normalizarTexto(document.getElementById('buscar-pedido').value.trim());
    const pedidosFiltrados = filtro
      ? this.pedidosActuales.filter((p) => this.normalizarTexto(p.cliente).includes(filtro))
      : this.pedidosActuales;

    if (pedidosFiltrados.length === 0) {
      contenedor.innerHTML = filtro
        ? '<p class="texto-vacio">No se encontró ningún cliente con ese nombre.</p>'
        : '<p class="texto-vacio">No hay pedidos registrados en esta actividad.</p>';
      return;
    }

    pedidosFiltrados.forEach((ped) => {
      const calc = ActividadManager.calcularPedido(ped, this.actividadActual.precio_unitario);
      const card = document.createElement('article');
      card.className = 'card item-pedido';
      card.innerHTML = `
        <div class="pedido-cabecera">
          <strong>${this.escaparHTML(ped.cliente)}</strong> (${ped.cantidad} unid.)
          <span class="badge ${calc.claseEstado}">${calc.estado}</span>
        </div>
        <p>
          Total: <strong>${ActividadManager.formatearSoles(calc.total)}</strong> |
          Pagó: ${ActividadManager.formatearSoles(calc.pagado)} |
          Debe: <strong>${ActividadManager.formatearSoles(calc.saldo)}</strong>
        </p>
        <div class="acciones-fila">
          ${calc.saldo > 0 ? '<button class="btn btn-exito btn-saldar">Marcar Pagado</button>' : ''}
          <button class="btn btn-secundario btn-editar">Editar</button>
          <button class="btn btn-peligro btn-borrar">Borrar</button>
        </div>
      `;

      const btnSaldar = card.querySelector('.btn-saldar');
      if (btnSaldar) {
        btnSaldar.addEventListener('click', async () => {
          await this.db.actualizarPedido(ped.id, { monto_pagado: calc.total });
          await this.recargarDetalleActividad();
        });
      }

      card.querySelector('.btn-editar').addEventListener('click', () => {
        document.getElementById('edit-ped-id').value = ped.id;
        document.getElementById('edit-ped-cliente').value = ped.cliente;
        document.getElementById('edit-ped-cantidad').value = ped.cantidad;
        document.getElementById('edit-ped-pagado').value = ped.monto_pagado;
        document.getElementById('edit-ped-pagado').classList.remove('input-error');
        document.getElementById('edit-ped-error').hidden = true;
        document.getElementById('box-editar-pedido').hidden = false;
        document.getElementById('box-editar-pedido').scrollIntoView({ behavior: 'smooth' });
      });

      card.querySelector('.btn-borrar').addEventListener('click', async () => {
        if (confirm(`¿Borrar el pedido de ${ped.cliente}?`)) {
          await this.db.eliminarPedido(ped.id);
          await this.recargarDetalleActividad();
        }
      });

      contenedor.appendChild(card);
    });
  }

  renderizarGastos() {
    const tbody = document.getElementById('tbody-gastos');
    tbody.innerHTML = '';

    const insumosDonados = this.donacionesActuales.filter((d) => d.tipo === 'ingrediente');
    const totalGastos = this.gastosActuales.reduce((sum, g) => sum + (Number(g.costo) || 0), 0);
    document.getElementById('total-gastos-tabla').textContent =
      ActividadManager.formatearSoles(totalGastos);

    if (this.gastosActuales.length === 0 && insumosDonados.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" class="celda-vacia">No hay ingredientes ni gastos registrados.</td>
        </tr>
      `;
      return;
    }

    this.gastosActuales.forEach((gas) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${this.escaparHTML(gas.descripcion)}</td>
        <td><strong>${ActividadManager.formatearSoles(gas.costo)}</strong></td>
        <td><button class="btn btn-peligro btn-tabla-borrar">Borrar</button></td>
      `;

      tr.querySelector('.btn-tabla-borrar').addEventListener('click', async () => {
        await this.db.eliminarGasto(gas.id);
        await this.recargarDetalleActividad();
      });

      tbody.appendChild(tr);
    });

    insumosDonados.forEach((don) => {
      const tr = document.createElement('tr');
      const quien = don.donante ? ` (${this.escaparHTML(don.donante)})` : '';
      tr.innerHTML = `
        <td>${this.escaparHTML(don.detalle)}${quien}</td>
        <td><span class="badge estado-pagado">Donado</span></td>
        <td><small class="texto-tenue">Cubierto</small></td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderizarDonaciones() {
    const tbody = document.getElementById('tbody-donaciones');
    const tfoot = document.getElementById('tfoot-donaciones');
    tbody.innerHTML = '';

    const listaFiltrada =
      this.filtroDonaciones === 'todos'
        ? this.donacionesActuales
        : this.donacionesActuales.filter((d) => d.tipo === this.filtroDonaciones);

    if (this.filtroDonaciones === 'dinero') {
      const totalDinero = listaFiltrada.reduce((sum, d) => sum + (Number(d.monto) || 0), 0);
      document.getElementById('total-donaciones-tabla').textContent =
        ActividadManager.formatearSoles(totalDinero);
      tfoot.hidden = false;
    } else {
      tfoot.hidden = true;
    }

    if (listaFiltrada.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="celda-vacia">No hay donaciones en esta categoría.</td>
        </tr>
      `;
      return;
    }

    listaFiltrada.forEach((don) => {
      const tr = document.createElement('tr');
      const nombreDonante = don.donante || don.detalle;
      const esIngrediente = don.tipo === 'ingrediente';

      const badgeTipo = esIngrediente
        ? '<span class="badge estado-parcial">Ingrediente</span>'
        : '<span class="badge estado-pagado">Dinero</span>';

      const equivalente = esIngrediente
        ? this.escaparHTML(don.detalle)
        : `<strong>${ActividadManager.formatearSoles(don.monto)}</strong>`;

      tr.innerHTML = `
        <td>${this.escaparHTML(nombreDonante)}</td>
        <td>${badgeTipo}</td>
        <td>${equivalente}</td>
        <td><button class="btn btn-peligro btn-tabla-borrar">Borrar</button></td>
      `;

      tr.querySelector('.btn-tabla-borrar').addEventListener('click', async () => {
        await this.db.eliminarDonacion(don.id);
        await this.recargarDetalleActividad();
      });

      tbody.appendChild(tr);
    });
  }

  renderizarBalance() {
    const bal = ActividadManager.calcularBalance(
      this.actividadActual,
      this.pedidosActuales,
      this.gastosActuales,
      this.donacionesActuales
    );

    document.getElementById('bal-ganancia').textContent =
      ActividadManager.formatearSoles(bal.gananciaNeta);

    const notaCaja =
      bal.efectivoLibreEnCaja >= 0
        ? `Recaudado al momento: ${ActividadManager.formatearSoles(bal.efectivoLibreEnCaja)}`
        : `Falta cobrar ${ActividadManager.formatearSoles(Math.abs(bal.efectivoLibreEnCaja))} para cubrir gastos`;
    document.getElementById('bal-nota-caja').textContent = notaCaja;

    const dona = document.getElementById('grafico-circular');
    const pct = bal.porcentajeCobrado;
    document.getElementById('grafico-porcentaje').textContent = `${pct}%`;

    if (bal.totalVendido > 0) {
      dona.style.background = `conic-gradient(#27ae60 0% ${pct}%, #eb5757 ${pct}% 100%)`;
    } else {
      dona.style.background = 'var(--bg-input)';
    }

    document.getElementById('bal-vendido').textContent =
      ActividadManager.formatearSoles(bal.totalVendido);
    document.getElementById('bal-recaudado').textContent =
      ActividadManager.formatearSoles(bal.totalRecaudado);
    document.getElementById('bal-por-cobrar').textContent =
      ActividadManager.formatearSoles(bal.totalPorCobrar);

    document.getElementById('bal-unidades').textContent = `${bal.totalUnidades} unid.`;
    document.getElementById('bal-gastos').textContent =
      ActividadManager.formatearSoles(bal.totalGastos);
    document.getElementById('bal-donaciones').textContent =
      `- ${ActividadManager.formatearSoles(bal.totalDonacionesDinero)}`;
    document.getElementById('bal-gasto-real').textContent =
      ActividadManager.formatearSoles(bal.gastoRealBolsillo);
  }

  escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto || '';
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
});