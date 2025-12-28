import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIf } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgIf],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private auth = inject(AuthService);
  private toast = inject(ToastService);
  private router = inject(Router);

  busy = signal(false);
  form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    try {
      const u = await this.auth.login(this.form.value.email!, this.form.value.password!);
      if (!u) {
        this.toast.show('Correo o contraseña incorrectos.', 'danger');
        return;
      }
      this.toast.show(`Bienvenido, ${u.nombre}.`, 'success');
      await this.router.navigateByUrl('/dashboard');
    } catch (e: any) {
      this.toast.show('No se pudo iniciar sesión. Revisa el backend o el proxy.', 'danger');
    } finally {
      this.busy.set(false);
    }
  }
}
