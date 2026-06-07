import { Controller, Post, Body, Param, Req } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { Public } from '../common/decorators';
import { Request } from 'express';

@Controller('v1')
export class GatewayController {
  constructor(private gateway: GatewayService) {}

  @Public()
  @Post('chat/completions')
  chatCompletions(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    return this.gateway.chatCompletions(
      req.headers.authorization,
      body,
      req.ip,
    );
  }

  @Public()
  @Post('agents/:agentId/chat')
  agentChat(
    @Req() req: Request,
    @Param('agentId') agentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.gateway.agentChat(
      req.headers.authorization,
      agentId,
      body,
      req.ip,
    );
  }
}
