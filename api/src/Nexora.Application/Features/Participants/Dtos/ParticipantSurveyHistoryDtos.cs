namespace Nexora.Application.Features.Participants.Dtos;

// Kullanıcı isteği (2026-08-05): katılımcı detayındaki "Anketler" sekmesinin gerçek veriye
// bağlanması — bu kişinin katıldığı anketler, verdiği cevaplar. Anonim anketlerde kimlik hiç
// kaydedilmediği için (bkz. ISurveyRepository.GetResponsesForParticipantAsync) o anketler bu
// listede görünmez; bu bilinçli bir mahremiyet kararıdır, veri eksikliği değildir.

public record ParticipantSurveyAnswerDto(
    Guid QuestionId,
    string QuestionText,
    string QuestionType,
    string? RawAnswer,
    string AnswerDisplay);

public record ParticipantSurveyResponseDto(
    Guid ResponseId,
    Guid SurveyId,
    string SurveyTitle,
    string SurveyCategory,
    DateTime SubmittedAt,
    int AnsweredQuestionCount,
    int TotalQuestionCount,
    List<ParticipantSurveyAnswerDto> Answers);

