import {
  IEnvironment,
  StepDataDto,
  StepTypeEnum,
  StepUpdateDto,
  UpdateWorkflowDto,
  WorkflowOriginEnum,
  WorkflowResponseDto,
} from '@novu/shared';
import { AnimatePresence, motion } from 'motion/react';
import { HTMLAttributes, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { RiArrowLeftSLine, RiArrowRightSLine, RiCloseFill, RiDeleteBin2Line, RiPencilRuler2Fill } from 'react-icons/ri';
import { Link, useNavigate } from 'react-router-dom';

import { ConfirmationModal } from '@/components/confirmation-modal';
import { PageMeta } from '@/components/page-meta';
import { Button } from '@/components/primitives/button';
import { CopyButton } from '@/components/primitives/copy-button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/primitives/form/form';
import { Input, InputField } from '@/components/primitives/input';
import { Separator } from '@/components/primitives/separator';
import { SidebarContent, SidebarFooter, SidebarHeader } from '@/components/side-navigation/sidebar';
import TruncatedText from '@/components/truncated-text';
import {
  flattenIssues,
  getFirstBodyErrorMessage,
  getFirstControlsErrorMessage,
  updateStepInWorkflow,
} from '@/components/workflow-editor/step-utils';
import { ConfigureStepTemplateIssueCta } from '@/components/workflow-editor/steps/configure-step-template-issue-cta';
import { DelayControlValues } from '@/components/workflow-editor/steps/delay/delay-control-values';
import { DigestControlValues } from '@/components/workflow-editor/steps/digest/digest-control-values';
import { ConfigureEmailStepPreview } from '@/components/workflow-editor/steps/email/configure-email-step-preview';
import { ConfigureInAppStepPreview } from '@/components/workflow-editor/steps/in-app/configure-in-app-step-preview';
import { SaveFormContext } from '@/components/workflow-editor/steps/save-form-context';
import { SdkBanner } from '@/components/workflow-editor/steps/sdk-banner';
import { ConfigureSmsStepPreview } from '@/components/workflow-editor/steps/sms/configure-sms-step-preview';
import { useFormAutosave } from '@/hooks/use-form-autosave';
import {
  AUTOCOMPLETE_PASSWORD_MANAGERS_OFF,
  INLINE_CONFIGURABLE_STEP_TYPES,
  STEP_TYPE_LABELS,
  TEMPLATE_CONFIGURABLE_STEP_TYPES,
} from '@/utils/constants';
import { getStepDefaultValues } from '@/components/workflow-editor/step-default-values';
import { buildRoute, ROUTES } from '@/utils/routes';
import { ConfigurePushStepPreview } from '@/components/workflow-editor/steps/push/configure-push-step-preview';
import { ConfigureChatStepPreview } from '@/components/workflow-editor/steps/chat/configure-chat-step-preview';

const STEP_TYPE_TO_INLINE_CONTROL_VALUES: Record<StepTypeEnum, () => React.JSX.Element | null> = {
  [StepTypeEnum.DELAY]: DelayControlValues,
  [StepTypeEnum.DIGEST]: DigestControlValues,
  [StepTypeEnum.IN_APP]: () => null,
  [StepTypeEnum.EMAIL]: () => null,
  [StepTypeEnum.SMS]: () => null,
  [StepTypeEnum.CHAT]: () => null,
  [StepTypeEnum.PUSH]: () => null,
  [StepTypeEnum.CUSTOM]: () => null,
  [StepTypeEnum.TRIGGER]: () => null,
};

const STEP_TYPE_TO_PREVIEW: Record<StepTypeEnum, ((props: HTMLAttributes<HTMLDivElement>) => ReactNode) | null> = {
  [StepTypeEnum.IN_APP]: ConfigureInAppStepPreview,
  [StepTypeEnum.EMAIL]: ConfigureEmailStepPreview,
  [StepTypeEnum.SMS]: ConfigureSmsStepPreview,
  [StepTypeEnum.CHAT]: ConfigureChatStepPreview,
  [StepTypeEnum.PUSH]: ConfigurePushStepPreview,
  [StepTypeEnum.CUSTOM]: null,
  [StepTypeEnum.TRIGGER]: null,
  [StepTypeEnum.DIGEST]: null,
  [StepTypeEnum.DELAY]: null,
};

type ConfigureStepFormProps = {
  workflow: WorkflowResponseDto;
  environment: IEnvironment;
  step: StepDataDto;
  update: (data: UpdateWorkflowDto) => void;
};

export const ConfigureStepForm = (props: ConfigureStepFormProps) => {
  const { step, workflow, update, environment } = props;
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const supportedStepTypes = [
    StepTypeEnum.IN_APP,
    StepTypeEnum.SMS,
    StepTypeEnum.CHAT,
    StepTypeEnum.PUSH,
    StepTypeEnum.EMAIL,
    StepTypeEnum.DIGEST,
    StepTypeEnum.DELAY,
  ];

  const isSupportedStep = supportedStepTypes.includes(step.type);
  const isReadOnly = !isSupportedStep || workflow.origin === WorkflowOriginEnum.EXTERNAL;

  const isTemplateConfigurableStep = isSupportedStep && TEMPLATE_CONFIGURABLE_STEP_TYPES.includes(step.type);
  const isInlineConfigurableStep = isSupportedStep && INLINE_CONFIGURABLE_STEP_TYPES.includes(step.type);
  const hasCustomControls = Object.keys(step.controls.dataSchema ?? {}).length > 0 && !step.controls.uiSchema;
  const isInlineConfigurableStepWithCustomControls = isInlineConfigurableStep && hasCustomControls;

  const onDeleteStep = () => {
    update({ ...workflow, steps: workflow.steps.filter((s) => s._id !== step._id) });
    navigate(buildRoute(ROUTES.EDIT_WORKFLOW, { environmentSlug: environment.slug!, workflowSlug: workflow.slug }));
  };

  const registerInlineControlValues = useMemo(() => {
    return (step: StepDataDto) => {
      if (isInlineConfigurableStep) {
        return {
          controlValues: getStepDefaultValues(step),
        };
      }

      return {};
    };
  }, [isInlineConfigurableStep]);

  const defaultValues = useMemo(
    () => ({
      name: step.name,
      stepId: step.stepId,
      ...registerInlineControlValues(step),
    }),
    [step, registerInlineControlValues]
  );

  const form = useForm({
    defaultValues,
    shouldFocusError: false,
  });

  const { onBlur, saveForm } = useFormAutosave({
    previousData: defaultValues,
    form,
    isReadOnly,
    save: (data) => {
      // transform form fields to step update dto
      const updateStepData: Partial<StepUpdateDto> = {
        name: data.name,
        ...(data.controlValues ? { controlValues: data.controlValues } : {}),
      };
      update(updateStepInWorkflow(workflow, step.stepId, updateStepData));
    },
  });

  const firstError = useMemo(
    () =>
      step.issues ? getFirstBodyErrorMessage(step.issues) || getFirstControlsErrorMessage(step.issues) : undefined,
    [step]
  );

  const setControlValuesIssues = useCallback(() => {
    const stepIssues = flattenIssues(step.issues?.controls);
    const currentErrors = form.formState.errors;

    // Clear errors that are not in stepIssues
    Object.values(currentErrors).forEach((controlValues) => {
      Object.keys(controlValues).forEach((key) => {
        if (!stepIssues[`${key}`]) {
          form.clearErrors(`controlValues.${key}`);
        }
      });
    });

    // Set new errors from stepIssues
    Object.entries(stepIssues).forEach(([key, value]) => {
      form.setError(`controlValues.${key}`, { message: value });
    });
  }, [form, step]);

  useEffect(() => {
    setControlValuesIssues();
  }, [setControlValuesIssues]);

  const Preview = STEP_TYPE_TO_PREVIEW[step.type];
  const InlineControlValues = STEP_TYPE_TO_INLINE_CONTROL_VALUES[step.type];

  const value = useMemo(() => ({ saveForm }), [saveForm]);

  return (
    <>
      <PageMeta title={`Configure ${step.name}`} />
      <AnimatePresence>
        <motion.div
          className="flex h-full w-full flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0.1 }}
          transition={{ duration: 0.1 }}
        >
          <SidebarHeader className="flex items-center gap-2.5 text-sm font-medium">
            <Link
              to={buildRoute(ROUTES.EDIT_WORKFLOW, {
                environmentSlug: environment.slug!,
                workflowSlug: workflow.slug,
              })}
              className="flex items-center"
            >
              <Button variant="link" size="icon" className="size-4" type="button">
                <RiArrowLeftSLine />
              </Button>
            </Link>
            <span>Configure Step</span>
            <Link
              to={buildRoute(ROUTES.EDIT_WORKFLOW, {
                environmentSlug: environment.slug!,
                workflowSlug: workflow.slug,
              })}
              className="ml-auto flex items-center"
            >
              <Button variant="link" size="icon" className="size-4" type="button">
                <RiCloseFill />
              </Button>
            </Link>
          </SidebarHeader>

          <Separator />

          <Form {...form}>
            <form onBlur={onBlur}>
              <SaveFormContext.Provider value={value}>
                <SidebarContent>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <InputField>
                          <FormControl>
                            <Input
                              placeholder="Untitled"
                              {...field}
                              disabled={isReadOnly}
                              {...AUTOCOMPLETE_PASSWORD_MANAGERS_OFF}
                            />
                          </FormControl>
                        </InputField>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={'stepId'}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Identifier</FormLabel>
                        <InputField className="flex overflow-hidden pr-0">
                          <FormControl>
                            <Input placeholder="Untitled" className="cursor-default" {...field} readOnly />
                          </FormControl>
                          <CopyButton valueToCopy={field.value} size="input-right" />
                        </InputField>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </SidebarContent>
                <Separator />

                {isInlineConfigurableStep && !hasCustomControls && <InlineControlValues />}
              </SaveFormContext.Provider>
            </form>
          </Form>

          {(isTemplateConfigurableStep || isInlineConfigurableStepWithCustomControls) && (
            <>
              <SidebarContent>
                <Link to={'./edit'} relative="path" state={{ stepType: step.type }}>
                  <Button
                    variant="outline"
                    className="flex w-full justify-start gap-1.5 text-xs font-medium"
                    type="button"
                  >
                    <RiPencilRuler2Fill className="h-4 w-4 text-neutral-600" />
                    Configure {STEP_TYPE_LABELS[step.type]} Step template{' '}
                    <RiArrowRightSLine className="ml-auto h-4 w-4 text-neutral-600" />
                  </Button>
                </Link>
              </SidebarContent>
              <Separator />

              {firstError ? (
                <>
                  <ConfigureStepTemplateIssueCta step={step} issue={firstError} />
                  <Separator />
                </>
              ) : (
                Preview && (
                  <>
                    <SidebarContent>
                      <Preview />
                    </SidebarContent>
                    <Separator />
                  </>
                )
              )}
            </>
          )}

          {!isSupportedStep && (
            <SidebarContent>
              <SdkBanner />
            </SidebarContent>
          )}

          {!isReadOnly && (
            <SidebarFooter>
              <Separator />
              <ConfirmationModal
                open={isDeleteModalOpen}
                onOpenChange={setIsDeleteModalOpen}
                onConfirm={onDeleteStep}
                title="Proceeding will delete the step"
                description={
                  <>
                    You're about to delete the{' '}
                    <TruncatedText className="max-w-[32ch] font-bold">{step.name}</TruncatedText> step, this action is
                    permanent.
                  </>
                }
                confirmButtonText="Delete"
              />
              <Button
                variant="ghostDestructive"
                className="gap-1.5 text-xs"
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                <RiDeleteBin2Line className="size-4" />
                Delete step
              </Button>
            </SidebarFooter>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
};
