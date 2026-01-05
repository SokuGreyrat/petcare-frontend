import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdopcionesComponent } from './adopciones';

describe('AdopcionesComponent', () => {
  let component: AdopcionesComponent;
  let fixture: ComponentFixture<AdopcionesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdopcionesComponent] // standalone component
    }).compileComponents();

    fixture = TestBed.createComponent(AdopcionesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
