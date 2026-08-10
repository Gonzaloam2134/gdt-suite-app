const loadReportes = async () => {
  try {
    setLoading(true)
    
    const { data: localData } = await supabase.from('locales').select('nombre').eq('id', activeLocalId).single()
    if (localData) setBusinessName(localData.nombre)

    const hoy = new Date()
    const hoyStr = hoy.toISOString().split('T')[0]
    
    // Fechas del mes actual en formato ISO completo
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1, 0, 0, 0, 0).toISOString()
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()
    
    // Fechas del mes anterior
    const primerDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1, 0, 0, 0, 0).toISOString()
    const ultimoDiaMesAnterior = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59, 59, 999).toISOString()

    console.log('Filtros de fecha:', { primerDiaMes, ultimoDiaMes, activeLocalId })

    // Transacciones del mes actual
    const { data: currentMonthTx, error: txError } = await supabase
      .from('transacciones')
      .select(`
        *,
        medios_pago (
          id,
          nombre,
          dias_acreditacion,
          cuenta_bancaria,
          banco_emisor,
          tipo_comision,
          valor_comision,
          subcategorias_pago (
            id,
            nombre,
            categorias_pago (id, nombre, icono)
          )
        )
      `)
      .eq('local_id', activeLocalId)
      .gte('creado_en', primerDiaMes)
      .lte('creado_en', ultimoDiaMes)
      .order('creado_en', { ascending: false })

    if (txError) {
      console.error('Error en query de transacciones:', txError)
    }

    console.log('Transacciones encontradas:', currentMonthTx?.length || 0)

    // Transacciones del mes anterior
    const { data: lastMonthTx } = await supabase
      .from('transacciones')
      .select('*')
      .eq('local_id', activeLocalId)
      .gte('creado_en', primerDiaMesAnterior)
      .lte('creado_en', ultimoDiaMesAnterior)

    if (currentMonthTx && currentMonthTx.length > 0) {
      // Resumen del mes
      const totalFacturado = currentMonthTx
        .filter(t => t.tipo === 'COBRO_RECIBIDO')
        .reduce((sum, t) => sum + t.monto, 0)

      const totalComisiones = currentMonthTx
        .filter(t => t.tipo === 'COBRO_RECIBIDO')
        .reduce((sum, t) => sum + (t.comision_monto || 0), 0)

      const totalNeto = totalFacturado - totalComisiones

      const totalGastos = currentMonthTx
        .filter(t => t.tipo === 'GASTO_REGISTRADO')
        .reduce((sum, t) => sum + t.monto, 0)

      const yaAcreditado = currentMonthTx
        .filter(t => {
          const isIncome = t.tipo === 'COBRO_RECIBIDO'
          const accreditationDate = t.fecha_acreditacion_estimada || hoyStr
          return isIncome && accreditationDate <= hoyStr
        })
        .reduce((sum, t) => sum + (t.monto - (t.comision_monto || 0)), 0)

      const porAcreditar = currentMonthTx
        .filter(t => {
          const isIncome = t.tipo === 'COBRO_RECIBIDO'
          const accreditationDate = t.fecha_acreditacion_estimada || hoyStr
          return isIncome && accreditationDate > hoyStr
        })
        .reduce((sum, t) => sum + (t.monto - (t.comision_monto || 0)), 0)

      setMonthlySummary({
        totalFacturado,
        totalComisiones,
        totalNeto,
        totalGastos,
        yaAcreditado,
        porAcreditar,
        cantidadTransacciones: currentMonthTx.filter(t => t.tipo === 'COBRO_RECIBIDO').length
      })

      // Proyección semanal
      const semanas = []
      const diasEnMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
      
      for (let semana = 1; semana <= Math.ceil(diasEnMes / 7); semana++) {
        const inicioSemana = new Date(hoy.getFullYear(), hoy.getMonth(), (semana - 1) * 7 + 1).toISOString().split('T')[0]
        const finSemana = new Date(hoy.getFullYear(), hoy.getMonth(), Math.min(semana * 7, diasEnMes)).toISOString().split('T')[0]
        
        const ingresosSemana = currentMonthTx
          .filter(t => {
            const isIncome = t.tipo === 'COBRO_RECIBIDO'
            const accreditationDate = t.fecha_acreditacion_estimada || hoyStr
            return isIncome && accreditationDate >= inicioSemana && accreditationDate <= finSemana
          })
          .reduce((sum, t) => sum + (t.monto - (t.comision_monto || 0)), 0)

        semanas.push({
          semana,
          inicio: inicioSemana,
          fin: finSemana,
          total: ingresosSemana,
          esSemanaActual: hoy >= new Date(inicioSemana) && hoy <= new Date(finSemana)
        })
      }
      
      setWeeklyProjection(semanas)

      // Desglose por medio de pago
      const methodsMap = {}
      currentMonthTx
        .filter(t => t.tipo === 'COBRO_RECIBIDO')
        .forEach(t => {
          const method = t.medios_pago
          if (!method) return
          
          const methodName = method.nombre || 'Desconocido'
          const banco = method.banco_emisor || ''
          const key = banco ? `${methodName} (${banco})` : methodName
          
          if (!methodsMap[key]) {
            methodsMap[key] = {
              nombre: key,
              facturado: 0,
              comisiones: 0,
              neto: 0,
              cantidad: 0,
              yaAcreditado: 0,
              porAcreditar: 0
            }
          }
          
          methodsMap[key].facturado += t.monto
          methodsMap[key].comisiones += (t.comision_monto || 0)
          methodsMap[key].neto += (t.monto - (t.comision_monto || 0))
          methodsMap[key].cantidad += 1
          
          const accreditationDate = t.fecha_acreditacion_estimada || hoyStr
          if (accreditationDate <= hoyStr) {
            methodsMap[key].yaAcreditado += (t.monto - (t.comision_monto || 0))
          } else {
            methodsMap[key].porAcreditar += (t.monto - (t.comision_monto || 0))
          }
        })
      
      setMethodBreakdown(Object.values(methodsMap).sort((a, b) => b.neto - a.neto))

      // Comparativa con mes anterior
      if (lastMonthTx && lastMonthTx.length > 0) {
        const lastMonthFacturado = lastMonthTx
          .filter(t => t.tipo === 'COBRO_RECIBIDO')
          .reduce((sum, t) => sum + t.monto, 0)

        const lastMonthComisiones = lastMonthTx
          .filter(t => t.tipo === 'COBRO_RECIBIDO')
          .reduce((sum, t) => sum + (t.comision_monto || 0), 0)

        const lastMonthNeto = lastMonthFacturado - lastMonthComisiones

        const variacionFacturacion = lastMonthFacturado > 0 
          ? ((totalFacturado - lastMonthFacturado) / lastMonthFacturado * 100)
          : 0

        setLastMonthComparison({
          facturado: lastMonthFacturado,
          comisiones: lastMonthComisiones,
          neto: lastMonthNeto,
          variacion: variacionFacturacion
        })
      }
    }
  } catch (err) {
    console.error('Error cargando reportes:', err)
  } finally {
    setLoading(false)
  }
}
