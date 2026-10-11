# Free Mobile SMS

Esta integración envía **notificaciones por SMS** a su propio número de teléfono, usando la API SMS gratuita de **Free Mobile**. Es un canal de **solo envío**: Gladys puede enviarle un SMS (notificación de una escena, alerta…), pero no hay ningún canal de recepción — no puede responder al SMS para controlar Gladys.

## Requisitos

- Una suscripción a **Free Mobile** (la oferta móvil de Free, no la Freebox).
- La opción **«Notifications par SMS»** (notificaciones por SMS) activada en su cuenta.

## Activar la opción y obtener sus credenciales

1. Inicie sesión en su **área de cliente de Free Mobile** en [https://mobile.free.fr](https://mobile.free.fr).
2. Abra el menú **«Mes options»** (Mis opciones).
3. Busque la línea **«Notifications par SMS»** y **actívela**.
4. En esa misma página, Free Mobile muestra dos datos que necesitará:
   - su **identificador** («Customer ID», un login de 8 cifras);
   - una **clave de API** (generada para usted; puede regenerarla si es necesario).

Tenga a mano ambos valores: son los que introducirá en Gladys.

> **Importante:** si desactiva y vuelve a activar la opción «Notifications par SMS», se genera una **nueva clave de API**. Recuerde entonces actualizarla en la configuración de Gladys.

![Dónde encontrar el identificador y la clave de API, y dónde introducirlos en Gladys](images/setup.svg)

## Configurar la integración en Gladys

1. En Gladys, abra la página de **Configuración** de la integración Free Mobile SMS.
2. En el bloque **«Mi cuenta»**, rellene:
   - **Identificador de Free Mobile** → su login de 8 cifras;
   - **Clave de API de Free Mobile** → la clave obtenida en el paso anterior (se guarda cifrada y no se vuelve a mostrar nunca).
3. **Guarde.** Eso es todo.

Cada usuario de Gladys introduce **sus propias** credenciales en su bloque «Mi cuenta». Los SMS se envían siempre al número de la cuenta de Free Mobile correspondiente.

## Uso

Una vez configurada, la integración recibe los mensajes salientes que Gladys le dirige (por ejemplo la acción **«Enviar un mensaje»** de una escena, o una alerta) y los reenvía por SMS a su teléfono. No hace falta nada más.

## Limitaciones

- **Envío solo a su propio número**: la API de Free Mobile no permite enviar a un número cualquiera.
- **Sin recepción**: no puede responder al SMS para hablar con Gladys.
- **Solo SMS de texto**: los archivos adjuntos (imágenes) no se reenvían.
- **Mensajes largos**: Free Mobile acepta hasta 999 caracteres por SMS. Un mensaje más largo se envía en varios SMS, numerados «(1/2)», «(2/2)»…
- **Límite de envío**: Free Mobile rechaza los mensajes demasiado seguidos. La integración envía los mensajes de un mismo usuario uno tras otro y, cuando Free Mobile pide ir más despacio, lo vuelve a intentar dos veces (tras 2 y luego 5 segundos) antes de abandonar.

## Solución de problemas

- **No recibo ningún SMS**: compruebe que la opción «Notifications par SMS» está **activada** y que el identificador y la clave de API son correctos.
- **Error de acceso denegado**: el identificador o la clave probablemente son incorrectos, o la opción se ha desactivado. Regenere la clave desde su área de cliente y actualícela en Gladys.
- **Error «demasiados SMS enviados»**: se enviaron varios mensajes en pocos segundos y Free Mobile siguió rechazándolos tras los reintentos. Espacie las acciones «Enviar un mensaje» de sus escenas (basta con una breve espera entre dos).
