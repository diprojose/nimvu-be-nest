import { BadRequestException } from '@nestjs/common';
import { normalizeCustomText, parseCustomText } from './custom-text';

describe('frase de producto personalizable', () => {
  it('quita espacios sobrantes, lineas vacias y el punto final', () => {
    expect(normalizeCustomText('  nadie   me \n\n cae bien.  ')).toBe(
      'nadie me\ncae bien',
    );
  });

  it('acepta tildes, ñ y signos de apertura', () => {
    expect(parseCustomText('¿Mañana? ¡Jamás!', 'Tote')).toBe(
      '¿Mañana? ¡Jamás!',
    );
  });

  it.each([
    ['vacia', '   '],
    ['solo un punto', '.'],
    ['con emoji', 'hola 🌵'],
    ['con html', '<b>hola</b>'],
    ['demasiado larga', 'a'.repeat(61)],
    ['con demasiadas lineas', 'a\nb\nc\nd\ne\nf\ng'],
  ])('rechaza una frase %s', (_, frase) => {
    expect(() => parseCustomText(frase, 'Tote')).toThrow(BadRequestException);
  });

  it('rechaza cuando no llega la frase', () => {
    expect(() => parseCustomText(undefined, 'Tote')).toThrow(
      BadRequestException,
    );
  });
});
