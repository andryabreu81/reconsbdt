import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { DatePipe } from '@angular/common';
import {
  RecaptchaModule,
  RECAPTCHA_SETTINGS,
  RecaptchaSettings,
} from 'ng-recaptcha';

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import { Directive, HostListener, Input } from '@angular/core';

// interfaces para la invocacion de las APIs Rest del BackEnd
interface TipoReclamo {
  claim_type_id: number;
  claim_type_name: string;
}

interface TipoProducto {
  product_claim_type_id: number;
  product_claim_name: string;
}

interface ReconsByCedula {
  tipo_reclamo: string;
  tipo_producto: string;
  nombre_cliente: string;
  cedula: string;
  rif: string;
}

@Directive({
  selector: '[appInputFilter]',
  standalone: true,
})
export class InputFilterDirective {
  // Recibe el tipo de filtro: 'numeric', 'alphanumeric', o 'text'
  @Input('appInputFilter') filterType: string = 'alphanumeric';

  private regexMap: Record<string, RegExp> = {
    numeric: /^[0-9]*$/,
    alphanumeric: /^[a-zA-Z0-9]*$/,
    text: /^[a-zA-ZáéíóúÁÉÍÓÚñÑ ]*$/,
    email: /^[a-zA-Z0-9@._-]*$/,
  };

  @HostListener('keypress', ['$event'])
  onKeyPress(event: KeyboardEvent) {
    const pattern = this.regexMap[this.filterType];
    if (!pattern.test(event.key)) {
      event.preventDefault(); // Bloquea el caracter si no coincide
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent) {
    const clipboardData = event.clipboardData;
    const pastedText = clipboardData?.getData('text') || '';
    const pattern = this.regexMap[this.filterType];

    if (!pattern.test(pastedText)) {
      event.preventDefault(); // Bloquea el pegado si contiene caracteres prohibidos
    }
  }
}


@Component({
  selector: 'app-recons',
  standalone: true,
  imports: [
    FormsModule,
    JsonPipe,
    DatePipe,
    RecaptchaModule,
    InputFilterDirective,
  ],

  templateUrl: './recons.component.html',
  styleUrl: './recons.component.css',
})
export class ReconsComponent {
  title = 'Reconsideraciones BDT';
  logoBDT: string = 'images/logo_bdt2.png'; // Ruta de la imagen

  captchaToken: string | null = null;

  // Creamos la variable para el límite máximo de la fecha de reclamo, que será la fecha actual, para evitar que el usuario seleccione una fecha futura
  today: string = new Date().toISOString().split('T')[0];

  // Se ejecuta cuando el usuario marca la casilla exitosamente
  resolved(token: string | null) {
    this.captchaToken = token;
    console.log('Captcha resuelto con el token:', this.captchaToken);
  }

  // Manejar el token del reCAPTCHA
  onCaptchaResolved(token: string): void {
    this.captchaToken = token;
    //console.log('Token de reCAPTCHA:', token);
  }

  registroExitoso = false;

  getReconsResponse = false;

  fechaActual = new Date();

  // se prepara la data en json para el insert en base de datos

  datosPersonales = {
    nombre_completo: '',
    cedula: '',
    rif: '',
    tlf: '',
    email: '',
    direccion: '',
  };

  // Arreglo de reclamos (cada uno con sus campos específicos)
  reclamos: {
    fecha_reclamo: string;
    num_reclamo: string;
    tipo_reclamo: number;
    tipo_producto: number;
    num_referencia: string;
    monto: string;
    num_tarjeta: string;
    num_cuenta: string;
    descripcion: string;
  }[] = [
    {
      fecha_reclamo: '',
      num_reclamo: '',
      tipo_reclamo: 0,
      tipo_producto: 0,
      num_referencia: '',
      monto: '',
      num_tarjeta: '',
      num_cuenta: '',
      descripcion: '',
    },
  ]; // Inicia con 1 reclamo vacío

  tiposReclamos: Record<number, string> = {
    3: 'TRANSACCION DUPLICADA',
    4: 'TRANSACCION NO APLICADA',
    5: 'TRANSACCION FALLIDA',
    6: 'TRANSACCION NO DISPENSADA',
    7: 'MONTO RETENIDO',
    8: 'COBRO DE COMISIONES',
    9: 'COBRO DE INTERESES',
    10: 'DOMICILIACIONES',
    11: 'TRANSFERENCIA NO RECONOCIDA',
    12: 'DEBITO NO RECONOCIDO',
    13: 'ROBO',
    14: 'HURTO DE CHEQUE',
    15: 'PRESUNTA ESTAFA',
    16: 'CAMBIAZO',
    17: 'USURPACION DE IDENTIDAD',
  };

  tiposProductos: Record<number, string> = {
    2: 'BANCA EN LINEA',
    3: 'PUNTO DE VENTA',
    4: 'PAGO MOVIL',
    5: 'CAJERO AUTOMATICO',
  };

  tiposReclamo: TipoReclamo[] = [];

  tiposProducto: TipoProducto[] = [];

  reconsByCedula: ReconsByCedula[] = [];

  cedula: string = '';
  rif: string = '';
  tipo_reclamo: string = '';
  tipo_producto: string = '';
  observacion: string = '';
  email: string = '';
  fecha_reclamo: string = '';
  numero_reclamo: string = '';
  monto_reclamo: string = '';
  n_card: string = '';
  n_cuenta: string = '';
  nombre_cliente: string = '';
  phone: string = '';
  direccion: string = '';
  num_referencia: string = '';

  // ruta URL o DNS del servidor del backend de Node JS
  //server = 'http://localhost:3000';
  //server = 'https://apireconsdev.bdt.com.ve';
  server = 'https://apirecons.bdt.com.ve';
  //server = 'https://apireconsqa.bdt.com.ve';

  // Se prepara la URL del a API Rest de node JS
  private apiRegistrar = this.server + '/apirecbdt/registrar';
  //private apiAgencias = this.server + '/apirecbdt/agencias';
  private apiTipoReclamos = this.server + '/apirecbdt/tipo_reclamos';

  private apiTipoProductos = this.server + '/apirecbdt/tipo_productos';

  private apiReconsByCedula = this.server + '/apirecbdt/getReconsByCedula';

  constructor(private http: HttpClient) {
    // obtener los tipos de reclamos para cargarlos en el select del frontend
    // la variable o array datos, viene de la respuesta de la API, asi como estatus y mensaje
    this.http.get<{ datos: any[] }>(this.apiTipoReclamos).subscribe({
      next: (respuesta: any) => {
        //console.log('BackEnd = lista de tipos de reclamos', respuesta.datos);

        const datos = respuesta.datos;
        //console.log('Datos de tipos de reclamos:', datos);

        // Asignar los datos al array tiposReclamo, se envian al select de la vista con la variable tiposReclamo
        this.tiposReclamo = datos;
      },
      error: (err) => {
        console.error('Error al consultar los tipos de reclamos', err);
      },
    });

    this.http.get<{ datos: any[] }>(this.apiTipoProductos).subscribe({
      next: (respuesta: any) => {
        //console.log('BackEnd = lista de tipos de productos', respuesta.datos);

        const datos = respuesta.datos;
        //console.log('Datos de tipos de productos:', datos);

        // Asignar los datos al array tiposProducto, se envian al select de la vista con la variable tiposProducto
        this.tiposProducto = datos;
      },
      error: (err) => {
        console.error('Error al consultar los tipos de productos', err);
      },
    });
  } // fin del constructor

  private sanitizeInput(text: string): string {
    if (!text) return '';
    // Elimina etiquetas HTML y caracteres sospechosos
    return text
      .replace(/<[^>]*>/g, '') // Elimina <tags>
      .replace(/[<>'"&]/g, (match) => {
        // Escapa caracteres peligrosos
        const map: any = {
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
          '&': '&amp;',
        };
        return map[match];
      })
      .trim();
  }

  // funcion para registrar el formulario de reconsideracion en la BD, enviando los datos a la APIRest del BackEnd
  onSubmit() {
    // 1. Validaciones de datos personales
    if (!this.datosPersonales.cedula?.trim()) return this.validateCedula();
    if (!this.datosPersonales.nombre_completo?.trim())
      return this.validateNombreCliente();
    if (!this.datosPersonales.rif?.trim()) return this.validateRif();
    if (!this.datosPersonales.email?.trim()) return this.validateEmail();
    if (!this.datosPersonales.tlf?.trim()) return this.validatePhone();
    if (!this.datosPersonales.direccion?.trim())
      return this.validateDireccion();

    // Antes de enviar, sanitiza los campos críticos
    this.datosPersonales.nombre_completo = this.sanitizeInput(
      this.datosPersonales.nombre_completo,
    );
    this.datosPersonales.direccion = this.sanitizeInput(
      this.datosPersonales.direccion,
    );

    this.reclamos.forEach((r) => {
      r.descripcion = this.sanitizeInput(r.descripcion);
    });

    // 2. Filtrar reclamos válidos
    const reclamosValidos = this.reclamos.filter(
      (r) =>
        r.fecha_reclamo && r.num_reclamo && r.tipo_reclamo && r.descripcion,
    );

    if (reclamosValidos.length === 0) {
      Swal.fire('Aviso', 'Debe completar al menos un reclamo.', 'warning');
      return;
    }

    // VALIDACIÓN DEL CAPTCHA
    if (!this.captchaToken) {
      Swal.fire(
        'Aviso',
        'Por favor, marque la casilla "No soy un robot".',
        'warning',
      );
      return;
    }

    // Si hay token, enviamos directamente
    this.enviarFormularioAlBackend(this.captchaToken, reclamosValidos);
  }

  private enviarFormularioAlBackend(token: string, reclamosValidos: any[]) {
    // Ahora 'token' es recibido como parámetro y no dará error de "Cannot find name"
    const payload = {
      ...this.datosPersonales,
      reclamos: reclamosValidos,
      captchaToken: token,
    };

    this.http
      .post<{ estatus: string; message?: string }>(this.apiRegistrar, payload)
      .subscribe({
        next: (respuesta: any) => {
          if (respuesta.estatus === '200') {
            Swal.fire({
              title: 'Registro exitoso!',
              text: `Se han registrado ${reclamosValidos.length} reconsideración(es) con éxito.`,
              icon: 'success',
            });
            this.registroExitoso = true;
            this.getCedula(this.datosPersonales.cedula);
          } else {
            Swal.fire(
              'Aviso',
              respuesta.message || 'Error inesperado',
              'warning',
            );
          }
        },
        error: (response) => {
          this.manejarErrorEnvio(response);
        },
      });
  }

  private manejarErrorEnvio(response: any) {
    const codigo = response.status;
    const mensajes: Record<number, string> = {
      400: 'Usted ya ha realizado una reconsideración a este reclamo.',
      404: 'La reconsideración no ha podido ser registrada.',
      500: 'El servidor no responde. Intente más tarde.',
    };

    Swal.fire(
      codigo === 400 ? 'Aviso!' : 'Error!',
      mensajes[codigo] || 'Incidencia en el registro. Intente nuevamente.',
      codigo === 400 ? 'warning' : 'error',
    );
  }

  agregarReclamo() {
    this.reclamos.push({
      fecha_reclamo: '',
      num_reclamo: '',
      tipo_reclamo: 0,
      tipo_producto: 0,
      num_referencia: '',
      monto: '',
      num_tarjeta: '',
      num_cuenta: '',
      descripcion: '',
    });
  }

  eliminarReclamo(index: number) {
    if (this.reclamos.length > 1) {
      this.reclamos.splice(index, 1);
    }
  }

  /**
   * Metodo para obtener la cedula del formulario y pasarla como parametro al generar el PDF
   */
  getCedula($id?: string) {
    const cedulaValor = this.datosPersonales.cedula;
    console.log(`Cedula : ${cedulaValor}`);

    const parametro = {
      cedula: cedulaValor,
    };

    // se prepara la URL de la API Rest del BackEnd
    this.http
      .post<{ datos: any[] }>(this.apiReconsByCedula, parametro)
      .subscribe({
        next: (respuesta) => {
          console.log(
            'BackEnd = datos de reconsideracion del cliente',
            respuesta.datos,
          );

          const datos = respuesta.datos[0];
          this.getReconsResponse = true;

          this.cedula = datos.cedula;
          this.rif = datos.rif;
          this.tipo_reclamo = datos.tipo_reclamo;
          this.tipo_producto = datos.tipo_producto;
          this.observacion = datos.observacion;
          this.email = datos.email;
          this.fecha_reclamo = datos.fecha_reclamo;
          this.numero_reclamo = datos.numero_reclamo;
          this.monto_reclamo = datos.monto_reclamo;
          this.n_card = datos.n_card;
          this.n_cuenta = datos.n_cuenta;
          this.nombre_cliente = datos.nombre_cliente;
          this.phone = datos.phone;
          this.direccion = datos.direccion;
          this.num_referencia = datos.num_referencia;

          // invocamos la funcion que genera el PDF con los datos obtenidos
          this.generarPDFDesdeHTML();
        },
        error: (err) => {
          console.error(
            'Error al consultar la reconsideracion del cliente: ',
            err,
          );
        },
      });
  }

  /**
   * Metodo de generacion del PDF
   */
  generarPDFDesdeHTML() {
    const element = document.getElementById('pdf-preview');
    if (!element) return;

    // Guardar estado original
    const originalDisplay = element.style.display;
    element.style.display = 'block'; // Mostrar temporalmente

    setTimeout(() => {
      html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        allowTaint: true,
      })
        .then((canvas) => {
          // Restaurar estado
          element.style.display = originalDisplay;

          const imgData = canvas.toDataURL('image/jpeg', 0.95); // Usa JPEG para mayor // Fragmento para manejar múltiples páginas si la imagen es muy alta
          const imgWidth = 210;
          const pageHeight = 297;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          let heightLeft = imgHeight;
          let position = 0;

          const pdf = new jsPDF('p', 'mm', 'a4');

          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;

          while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
          }
          pdf.save('Solicitud_Reconsideracion_Reclamo.pdf');
        })
        .catch((err) => {
          element.style.display = originalDisplay;
          console.error('Error al generar PDF:', err);
          alert('Error al generar el PDF.');
        });
    }, 100); // Pequeño delay para asegurar renderizado
  }

  validateCedula() {
    const cedula = this.datosPersonales.cedula;

    if (!cedula || cedula.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe indicar un número de cédula válido.',
      });
    }
  }

  validateNombreCliente() {
    const nombre_cliente = this.datosPersonales.nombre_completo;

    if (!nombre_cliente || nombre_cliente.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe indicar el nombre del cliente.',
      });
    }
  }

  validateRif() {
    const rif = this.datosPersonales.rif;

    if (!rif || rif.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe indicar un número de rif válido.',
      });
    }
  }

  validateEmail() {
    const email = this.datosPersonales.email;

    if (!email || email.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe indicar un correo electrónico.',
      });
    }
  }

  validatePhone() {
    const telefono = this.datosPersonales.tlf;

    if (!telefono || telefono.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe indicar un número de teléfono.',
      });
    }
  }

  validateDireccion() {
    const direccion = this.datosPersonales.direccion;

    if (!direccion || direccion.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe indicar una dirección de habitación.',
      });
    }
  }

  validateFechaReclamo() {
    const fechaSeleccionada = new Date(this.reclamos[0].fecha_reclamo);
    const hoy = new Date();

    // Seteamos la hora a 0 para comparar solo fechas
    hoy.setHours(0, 0, 0, 0);

    if (fechaSeleccionada > hoy) {
      console.error('La fecha no puede ser futura');
      this.reclamos[0].fecha_reclamo = this.today; // Opcional: resetear a hoy
    }

    const fecha_reclamo = this.reclamos[0].fecha_reclamo;

    if (!fecha_reclamo || fecha_reclamo.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe seleccionar la fecha del reclamo.',
      });
    }
  }

  validateNumReclamo() {
    const num_reclamo = this.reclamos[0].num_reclamo;

    if (!num_reclamo || num_reclamo.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe indicar el número del reclamo.',
      });
    }
  }

  validateTipoProducto(indexActual: number) {
    const tipo_producto = this.reclamos[indexActual].tipo_producto;

    // 1. Validar que no esté vacío
    if (!tipo_producto || tipo_producto.toString().trim() === '') {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe seleccionar el tipo de producto.',
      });
      return; // Detenemos la ejecución si está vacío
    }

    // 2. Validar que no esté repetido en los demás reclamos
    // Buscamos si existe OTRO reclamo (con índice diferente) que tenga el mismo tipo_producto
    const esDuplicado = this.reclamos.some(
      (reclamo, idx) =>
        idx !== indexActual && reclamo.tipo_producto === tipo_producto,
    );

    if (esDuplicado) {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 4000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'warning', // Un warning queda excelente aquí
        title: 'Este tipo de producto ya fue seleccionado en otro reclamo.',
      });

      // Vaciamos el selector actual para obligar al usuario a elegir otro
      this.reclamos[indexActual].tipo_producto = 0;
    }
  }

  tieneProductosDuplicados(): boolean {
    const productos = this.reclamos
      .map((r) => r.tipo_producto)
      .filter((p) => p);
    return new Set(productos).size !== productos.length;
  }

  validateTipoReclamo() {
    const tipo_reclamo = this.reclamos[0].tipo_reclamo;

    if (!tipo_reclamo || tipo_reclamo.toString().trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe seleccionar el tipo de reclamo.',
      });
    }
  }

  validateNumReferencia() {
    const num_referencia = this.reclamos[0].num_referencia;

    if (!num_referencia || num_referencia.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe indicar el número de referencia del reclamo.',
      });
    }
  }

  validateMonto() {
    const monto = this.reclamos[0].monto;

    if (!monto || monto.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe indicar el monto del reclamo.',
      });
    }
  }

  validateNumTarjeta() {
    const num_tarjeta = this.reclamos[0].num_tarjeta;

    if (!num_tarjeta || num_tarjeta.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe indicar el número de tarjeta de débito.',
      });
    }
  }

  validateNumCuenta() {
    const num_cuenta = this.reclamos[0].num_cuenta;

    if (!num_cuenta || num_cuenta.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title: 'Debe indicar el número de cuenta.',
      });
    }
  }

  validateDescripcion() {
    const descripcion = this.reclamos[0].descripcion;

    if (!descripcion || descripcion.trim() === '') {
      //return false;
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.onmouseenter = Swal.stopTimer;
          toast.onmouseleave = Swal.resumeTimer;
        },
      });
      Toast.fire({
        icon: 'error',
        title:
          'Debe indicar la descripción clara y precisa de los hechos sucedidos.',
      });
    }
  }
}
