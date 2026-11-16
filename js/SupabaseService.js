class SupabaseService {
  constructor(config) {
    this.client = window.supabase.createClient(config.url, config.anonKey);
  }

  async iniciarSesion(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async cerrarSesion() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async obtenerUsuarioActual() {
    const { data: { session }, error } = await this.client.auth.getSession();
    if (error) throw error;
    return session ? session.user : null;
  }

  async listarActividades() {
    const { data, error } = await this.client
      .from('actividades')
      .select('*')
      .order('fecha', { ascending: false });
    if (error) throw error;
    return data;
  }

  async crearActividad(nombre, fecha, precioUnitario) {
    const { data, error } = await this.client
      .from('actividades')
      .insert([{ nombre, fecha, precio_unitario: precioUnitario }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async eliminarActividad(id) {
    const { error } = await this.client.from('actividades').delete().eq('id', id);
    if (error) throw error;
  }

  async listarPedidos(actividadId) {
    const { data, error } = await this.client
      .from('pedidos')
      .select('*')
      .eq('actividad_id', actividadId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async crearPedido(actividadId, cliente, cantidad, montoPagado) {
    const { data, error } = await this.client
      .from('pedidos')
      .insert([{
        actividad_id: actividadId,
        cliente,
        cantidad,
        monto_pagado: montoPagado
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async actualizarPedido(id, cambios) {
    const { data, error } = await this.client
      .from('pedidos')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async eliminarPedido(id) {
    const { error } = await this.client.from('pedidos').delete().eq('id', id);
    if (error) throw error;
  }

  async listarGastos(actividadId) {
    const { data, error } = await this.client
      .from('gastos')
      .select('*')
      .eq('actividad_id', actividadId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async crearGasto(actividadId, descripcion, costo) {
    const { data, error } = await this.client
      .from('gastos')
      .insert([{ actividad_id: actividadId, descripcion, costo }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async eliminarGasto(id) {
    const { error } = await this.client.from('gastos').delete().eq('id', id);
    if (error) throw error;
  }

  async listarDonaciones(actividadId) {
    const { data, error } = await this.client
      .from('donaciones')
      .select('*')
      .eq('actividad_id', actividadId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  }

  async crearDonacion(actividadId, tipo, donante, detalle, monto) {
    const { data, error } = await this.client
      .from('donaciones')
      .insert([{
        actividad_id: actividadId,
        tipo,
        donante,
        detalle,
        monto
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async eliminarDonacion(id) {
    const { error } = await this.client.from('donaciones').delete().eq('id', id);
    if (error) throw error;
  }
}