import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  it('sobe com o roteador e o tema', async () => {
    TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] });

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});
