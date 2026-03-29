declare module 'passport-discord' {
  import { Strategy as PassportStrategy } from 'passport';
  export interface Profile {
    id: string;
    username: string;
    discriminator?: string;
    avatar?: string;
    email?: string;
  }
  export class Strategy extends PassportStrategy {
    constructor(
      options: {
        clientID: string;
        clientSecret: string;
        callbackURL: string;
        scope: string[];
      },
      verify: (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: (err: Error | null, user?: unknown) => void,
      ) => void,
    );
  }
}
