import { Injectable } from '@nestjs/common';
import { MessageRepository } from '@novu/dal';
import { ExecutionDetailsSourceEnum, ExecutionDetailsStatusEnum } from '@novu/shared';

import { SendMessageType } from './send-message-type.usecase';
import { CreateLog } from '../../../shared/logs';
import { SendMessageCommand } from './send-message.command';
import { CreateExecutionDetails, CreateExecutionDetailsCommand } from '../create-execution-details';
import { DetailEnum } from '../create-execution-details/types';

@Injectable()
export class SendMessageDelay extends SendMessageType {
  constructor(
    protected messageRepository: MessageRepository,
    protected createLogUsecase: CreateLog,
    protected createExecutionDetails: CreateExecutionDetails
  ) {
    super(messageRepository, createLogUsecase, createExecutionDetails);
  }

  public async execute(command: SendMessageCommand) {
    await this.createExecutionDetails.execute(
      CreateExecutionDetailsCommand.create({
        ...CreateExecutionDetailsCommand.getDetailsFromJob(command.job),
        detail: DetailEnum.DELAY_FINISHED,
        source: ExecutionDetailsSourceEnum.INTERNAL,
        status: ExecutionDetailsStatusEnum.SUCCESS,
        isTest: false,
        isRetry: false,
      })
    );
  }
}
