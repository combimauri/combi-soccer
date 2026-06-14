import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { ProfileService } from '../services/profile.service';

/**
 * Gate for the betting action (not for browsing). Sends anonymous users to
 * sign-in, and first-time users to choose their mandatory username.
 */
export const requireUsername: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const profiles = inject(ProfileService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.parseUrl('/auth/sign-in');
  }

  await profiles.load();
  return profiles.hasUsername() ? true : router.parseUrl('/setup-username');
};
