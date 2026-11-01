import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type PreferenciaTema = 'claro' | 'escuro' | 'sistema';

const CHAVE = 'impa.tema';

/**
 * Tema claro/escuro. Padrão: preferência do sistema (`color-scheme: light dark`);
 * a escolha manual fica lembrada no navegador e vira `data-tema` no `<html>`.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly documento = inject(DOCUMENT);
  private readonly consulta =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

  private readonly sistemaEscuro = signal(this.consulta?.matches ?? false);

  readonly preferencia = signal<PreferenciaTema>(this.ler());
  readonly escuro = computed(() =>
    this.preferencia() === 'sistema' ? this.sistemaEscuro() : this.preferencia() === 'escuro',
  );

  constructor() {
    this.consulta?.addEventListener('change', (e) => this.sistemaEscuro.set(e.matches));

    effect(() => {
      const preferencia = this.preferencia();
      const html = this.documento.documentElement;
      if (preferencia === 'sistema') delete html.dataset['tema'];
      else html.dataset['tema'] = preferencia;
      this.gravar(preferencia);
    });
  }

  escolher(preferencia: PreferenciaTema): void {
    this.preferencia.set(preferencia);
  }

  private ler(): PreferenciaTema {
    try {
      const valor = localStorage.getItem(CHAVE);
      return valor === 'claro' || valor === 'escuro' ? valor : 'sistema';
    } catch {
      return 'sistema';
    }
  }

  private gravar(preferencia: PreferenciaTema): void {
    try {
      if (preferencia === 'sistema') localStorage.removeItem(CHAVE);
      else localStorage.setItem(CHAVE, preferencia);
    } catch {
      // Navegador sem armazenamento (aba privada): o tema vale só nesta visita.
    }
  }
}
