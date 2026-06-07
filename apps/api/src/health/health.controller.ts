import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  @Public()
  @Get()
  check() {
    return this.health.check();
  }
}
