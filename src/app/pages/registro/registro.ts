import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';
import { Usuario } from '../../models/api.models';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgIf],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  private router = inject(Router);

  busy = signal(false);
  form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(6)] }),
    curp: new FormControl('', { nonNullable: true }),
    telefonoCelular: new FormControl('', { nonNullable: true }),
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    try {
      const body: Usuario = {
        nombre: this.form.value.nombre!,
        email: this.form.value.email!,
        password: this.form.value.password!,
        curp: this.form.value.curp || undefined,
        telefonoCelular: this.form.value.telefonoCelular || undefined,
      };
      await new Promise<void>((resolve, reject) => {
        this.api.createUser(body).subscribe({
          next: () => resolve(),
          error: (e) => reject(e),
        });
      });

      this.toast.show('Cuenta creada. Ya puedes iniciar sesión.', 'success');
      await this.router.navigateByUrl('/login');
    } catch {
      this.toast.show('No se pudo crear la cuenta. Verifica que el backend esté activo.', 'danger');
    } finally {
      this.busy.set(false);
    }
  }
}
