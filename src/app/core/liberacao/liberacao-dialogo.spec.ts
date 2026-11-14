import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { URL_LIBERACOES } from './liberacao';
import { LiberacaoDialogo } from './liberacao-dialogo';

describe('LiberacaoDialogo', () => {
  let http: HttpTestingController;
  let fechar: ReturnType<typeof vi.fn>;
  let elemento: HTMLElement;
  let fixture: ComponentFixture<LiberacaoDialogo>;

  beforeEach(async () => {
    fechar = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { permissao: 'vendas.cancelar-concluida' } },
        { provide: MatDialogRef, useValue: { close: fechar } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LiberacaoDialogo);
    elemento = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  function preencher(usuario: string, senha: string): void {
    const [campoUsuario, campoSenha] = Array.from(elemento.querySelectorAll('input'));
    campoUsuario.value = usuario;
    campoUsuario.dispatchEvent(new Event('input'));
    campoSenha.value = senha;
    campoSenha.dispatchEvent(new Event('input'));
  }

  function enviar(): void {
    elemento.querySelector('form')!.dispatchEvent(new Event('submit'));
  }

  async function aguardar(): Promise<void> {
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();
  }

  it('mostra a operação que precisa de liberação', () => {
    expect(elemento.textContent).toContain('cancelar venda concluída');
  });

  it('envia usuário, senha e permissão e fecha com o token', async () => {
    preencher(' carla ', 'gerencia2026');
    enviar();

    const pedido = http.expectOne(URL_LIBERACOES);
    expect(pedido.request.body).toEqual({
      usuario: 'carla',
      senha: 'gerencia2026',
      permissao: 'vendas.cancelar-concluida',
    });
    pedido.flush(
      { token: 'abc', expiraEm: '2026-11-14T12:02:00Z' },
      { status: 201, statusText: 'Created' },
    );
    await aguardar();

    expect(fechar).toHaveBeenCalledWith('abc');
  });

  it('liberação recusada mostra a mensagem da API e não fecha', async () => {
    preencher('carla', 'errada-123');
    enviar();

    http
      .expectOne(URL_LIBERACOES)
      .flush({ mensagem: 'Usuário ou senha inválidos' }, { status: 403, statusText: 'Forbidden' });
    await aguardar();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'Usuário ou senha inválidos',
    );
    expect(fechar).not.toHaveBeenCalled();
  });

  it('limite de tentativas (429) mostra a mensagem da API no diálogo', async () => {
    preencher('carla', 'errada-123');
    enviar();

    http
      .expectOne(URL_LIBERACOES)
      .flush(
        { mensagem: 'Muitas tentativas de entrar. Aguarde um minuto e tente novamente' },
        { status: 429, statusText: 'Too Many Requests' },
      );
    await aguardar();

    expect(elemento.querySelector('[role="alert"]')?.textContent).toContain(
      'Muitas tentativas de entrar. Aguarde um minuto e tente novamente',
    );
    expect(fechar).not.toHaveBeenCalled();
  });

  it('sem usuário e senha não chama a API', () => {
    enviar();

    http.expectNone(URL_LIBERACOES);
  });

  it('cancelar fecha sem token', () => {
    (elemento.querySelector('button[type="button"]') as HTMLButtonElement).click();

    expect(fechar).toHaveBeenCalledWith();
  });
});
