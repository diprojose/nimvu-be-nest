import { BadRequestException } from '@nestjs/common';

/**
 * Reglas de la frase de un producto personalizable.
 *
 * La tienda aplica las mismas reglas mientras el cliente escribe
 * (nimvu-store/lib/tote-art.ts), pero la orden se valida aqui otra vez: lo que
 * se guarda es lo que se manda a estampar, y no puede depender de que el
 * navegador se haya portado bien.
 */
export const CUSTOM_TEXT_MAX_LENGTH = 60;
export const CUSTOM_TEXT_MAX_LINES = 6;

/**
 * Letras (con tildes y ñ), numeros y la puntuacion que trae la tipografia del
 * estampado. Quedan fuera los emojis y simbolos raros: en pantalla se verian
 * con una fuente de reemplazo y en la tela no saldrian.
 */
const ALLOWED = /^[\p{L}\p{N} .,;:!?¡¿'"()\-&#@%+/\n]+$/u;

/**
 * Deja la frase como se va a estampar: sin espacios sobrantes, sin lineas
 * vacias y sin el punto final, porque el diseno siempre cierra con el punto
 * negro de Nimvu y escribirlo daria dos.
 */
export function normalizeCustomText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .replace(/\.+$/, '')
    .trim();
}

/** Normaliza y valida. Lanza 400 con un mensaje que el cliente puede leer. */
export function parseCustomText(
  raw: string | undefined,
  productName: string,
): string {
  const text = normalizeCustomText(raw ?? '');

  if (!text) {
    throw new BadRequestException(
      `Escribe la frase para tu ${productName} antes de comprarlo.`,
    );
  }
  if (text.length > CUSTOM_TEXT_MAX_LENGTH) {
    throw new BadRequestException(
      `La frase no puede tener mas de ${CUSTOM_TEXT_MAX_LENGTH} caracteres.`,
    );
  }
  if (text.split('\n').length > CUSTOM_TEXT_MAX_LINES) {
    throw new BadRequestException(
      `La frase no puede tener mas de ${CUSTOM_TEXT_MAX_LINES} lineas.`,
    );
  }
  if (!ALLOWED.test(text)) {
    throw new BadRequestException(
      'La frase solo puede llevar letras, numeros y signos de puntuacion comunes (sin emojis).',
    );
  }

  return text;
}
